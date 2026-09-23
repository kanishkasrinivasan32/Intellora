from contextvars import ContextVar
from sqlalchemy import Column, String, create_engine, event, inspect, select
from sqlalchemy.orm import DeclarativeBase, Session as ORMSession, sessionmaker, with_loader_criteria
from app.config import settings

current_user_id: ContextVar[str] = ContextVar('intellora_user_id', default='kanishka')

class Base(DeclarativeBase):
    pass

class TenantOwned:
    """All private learning data belongs to exactly one account."""
    user_id = Column(String, nullable=False, index=True, default=lambda: current_user_id.get())


class TenantSession(ORMSession):
    def __init__(self, *args, user_id=None, unscoped=False, **kwargs):
        super().__init__(*args, **kwargs)
        # Pin an owner for the entire unit of work, including identity-map hits.
        self.info['user_id'] = user_id or current_user_id.get()
        self.info['unscoped'] = unscoped


@event.listens_for(TenantSession, 'do_orm_execute')
def scope_queries(execute_state):
    if execute_state.session.info.get('unscoped'):
        return
    if execute_state.is_select or execute_state.is_update or execute_state.is_delete:
        owner = execute_state.session.info['user_id']
        execute_state.statement = execute_state.statement.options(
            with_loader_criteria(TenantOwned, lambda row: row.user_id == owner, include_aliases=True)
        )


@event.listens_for(TenantSession, 'before_flush')
def scope_writes(db, flush_context, instances):
    if db.info.get('unscoped'):
        return
    owner = db.info['user_id']
    for row in db.new.union(db.dirty).union(db.deleted):
        if not isinstance(row, TenantOwned):
            continue
        if row in db.new and row.user_id is None:
            row.user_id = owner
        if row.user_id != owner:
            raise ValueError('This record belongs to a different account.')
        # Do not permit ownership reassignment of a previously loaded object.
        history = inspect(row).attrs.user_id.history
        if row not in db.new and history.has_changes():
            raise ValueError('Record ownership cannot be changed.')
        # Also protect child records against a foreign account's parent ID.
        if row not in db.deleted:
            for column in row.__table__.columns:
                for foreign_key in column.foreign_keys:
                    parent = foreign_key.column.table
                    value = getattr(row, column.name)
                    if value is None or 'user_id' not in parent.c:
                        continue
                    pending_parent = any(
                        isinstance(candidate, TenantOwned)
                        and candidate.__table__ is parent
                        and getattr(candidate, foreign_key.column.name) == value
                        and candidate.user_id in (None, owner)
                        for candidate in db.new
                    )
                    if not pending_parent and not db.connection().scalar(
                        select(parent.c.user_id).where(foreign_key.column == value, parent.c.user_id == owner)
                    ):
                        raise ValueError('The parent record does not belong to this account.')

engine = create_engine(f'sqlite:///{settings.data_dir / "sqlite" / "intellora.db"}', connect_args={'check_same_thread': False})
@event.listens_for(engine, 'connect')
def configure_sqlite(connection, record):
    connection.execute('PRAGMA journal_mode=WAL')
    connection.execute('PRAGMA foreign_keys=ON')
    connection.execute('PRAGMA busy_timeout=10000')

Session = sessionmaker(engine, class_=TenantSession, expire_on_commit=False)


def migrate_legacy_schema(target_engine=engine):
    """Upgrade the original SQLite workspace in place without losing its data."""
    with target_engine.begin() as connection:
        tables = set(inspect(connection).get_table_names())
        for table in Base.metadata.sorted_tables:
            if table.name not in tables:
                continue
            existing = {column['name'] for column in inspect(connection).get_columns(table.name)}
            if 'user_id' in table.c and 'user_id' not in existing:
                connection.exec_driver_sql(f'ALTER TABLE "{table.name}" ADD COLUMN user_id VARCHAR NOT NULL DEFAULT \'kanishka\'')
            if 'user_id' in table.c:
                connection.exec_driver_sql(f'UPDATE "{table.name}" SET user_id = \'kanishka\' WHERE user_id IS NULL')
                connection.exec_driver_sql(f'CREATE INDEX IF NOT EXISTS "ix_{table.name}_user_id" ON "{table.name}" (user_id)')
        if 'users' in tables:
            existing = {column['name'] for column in inspect(connection).get_columns('users')}
            additions = {'username': 'VARCHAR(40)', 'email': 'VARCHAR(320)', 'password_hash': 'VARCHAR', 'created_at': 'DATETIME', 'is_admin': 'BOOLEAN NOT NULL DEFAULT 0'}
            for column, definition in additions.items():
                if column not in existing:
                    connection.exec_driver_sql(f'ALTER TABLE users ADD COLUMN {column} {definition}')
            connection.exec_driver_sql('UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL')
            connection.exec_driver_sql('CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username_unique ON users (username)')
            connection.exec_driver_sql('CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email_unique ON users (email)')

        if 'flashcards' in tables:
            existing = {column['name'] for column in inspect(connection).get_columns('flashcards')}
            additions = {
                'explanation': "TEXT NOT NULL DEFAULT ''",
                'key_points': "JSON NOT NULL DEFAULT '[]'",
                'worked_example': "TEXT NOT NULL DEFAULT ''",
                'reference_links': "JSON NOT NULL DEFAULT '[]'",
            }
            for column, definition in additions.items():
                if column not in existing:
                    connection.exec_driver_sql(f'ALTER TABLE flashcards ADD COLUMN {column} {definition}')

        if 'notes' in tables:
            existing = {column['name'] for column in inspect(connection).get_columns('notes')}
            if 'topic' not in existing:
                connection.exec_driver_sql("ALTER TABLE notes ADD COLUMN topic VARCHAR NOT NULL DEFAULT 'General'")
                connection.exec_driver_sql('CREATE INDEX IF NOT EXISTS ix_notes_topic ON notes (topic)')

        if 'courses' in tables:
            existing = {column['name'] for column in inspect(connection).get_columns('courses')}
            if 'status' not in existing:
                connection.exec_driver_sql("ALTER TABLE courses ADD COLUMN status VARCHAR NOT NULL DEFAULT 'ready'")
            connection.exec_driver_sql('CREATE INDEX IF NOT EXISTS ix_courses_status ON courses (status)')
            if 'course_generation_jobs' in tables:
                # Old failed jobs published partial courses. Hide those drafts during
                # the upgrade; successful historical courses remain untouched.
                connection.exec_driver_sql(
                    "UPDATE courses SET status = 'failed' WHERE id IN "
                    "(SELECT course_id FROM course_generation_jobs WHERE status = 'failed' AND course_id IS NOT NULL)"
                )

        # SQLite cannot drop an inline UNIQUE constraint. These two leaf tables
        # must be rebuilt so every account can study the same named topic.
        for name, unique_column in [('topics', 'name'), ('progress', 'topic')]:
            if name not in tables:
                continue
            inspector = inspect(connection)
            constraints = inspector.get_unique_constraints(name) + [index for index in inspector.get_indexes(name) if index.get('unique')]
            if not any(item['column_names'] == [unique_column] for item in constraints):
                continue
            table = Base.metadata.tables[name]
            temporary_name = f'{name}__tenant_upgrade'
            from sqlalchemy.schema import CreateTable
            ddl = str(CreateTable(table).compile(dialect=connection.dialect)).replace(f'CREATE TABLE {name} ', f'CREATE TABLE {temporary_name} ', 1)
            connection.exec_driver_sql(ddl)
            columns = ', '.join(f'"{column.name}"' for column in table.columns)
            connection.exec_driver_sql(f'INSERT INTO "{temporary_name}" ({columns}) SELECT {columns} FROM "{name}"')
            connection.exec_driver_sql(f'DROP TABLE "{name}"')
            connection.exec_driver_sql(f'ALTER TABLE "{temporary_name}" RENAME TO "{name}"')
            for index in table.indexes:
                index.create(connection)

def get_db():
    with Session() as db:
        yield db

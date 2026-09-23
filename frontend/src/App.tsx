import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Anchor,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Copy,
  Cpu,
  FileText,
  Flag,
  Flame,
  FolderOpen,
  Globe,
  GraduationCap,
  Layers3,
  Library,
  Link2,
  Loader2,
  LockKeyhole,
  Map,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Network,
  NotebookPen,
  Plus,
  Search,
  Send,
  Settings2,
  Share2,
  Ship,
  Sparkles,
  Swords,
  Target,
  Trash2,
  TrendingUp,
  UploadCloud,
  Volume2,
  VolumeX,
  X,
  Youtube,
  Zap,
} from "lucide-react";
import {
  StrawHatIcon,
  LogPoseIcon,
  TreasureMapIcon,
  SnailPhoneIcon,
  DevilFruitIcon,
  TreasureChestIcon,
  VivreCardIcon,
  ThreeSwordsIcon,
  BountyPosterIcon,
  CaptainLogIcon,
} from "./components/PirateIcons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  api,
  post,
  type Course,
  type CourseJob,
  type Card,
  type Resource,
  type Topic,
  type Quiz,
  type Lesson,
} from "./lib/api";
import { playCue, type SoundEvent } from "./lib/sounds";
import { LessonVisual } from "./components/LessonVisual";
import { SettingsView } from "./components/SettingsView";
const KnowledgeGraphView = lazy(() =>
  import("./components/KnowledgeGraphView").then((module) => ({
    default: module.KnowledgeGraphView,
  })),
);

type Page =
  | "Overview"
  | "My courses"
  | "AI first mate"
  | "Grand Line map"
  | "Resource library"
  | "Flashcards"
  | "Quizzes"
  | "Captain’s notes"
  | "My progress"
  | "Settings";
type Modal =
  | "upload"
  | "generate-course"
  | "generate-cards"
  | "generate-quiz"
  | "search"
  | "reminders"
  | "share"
  | null;
type Note = {
  id: string;
  title: string;
  content: string;
  topic: string;
  updated_at: string;
};
const emptyProgress = {
  xp: 0,
  streak: 0,
  due_cards: 0,
  cards_reviewed: 0,
  lessons_completed: 0,
  today_xp: 0,
  topics: [],
  weekly: [],
  activity: [],
};
const nav = [
  {
    section: "YOUR VOYAGE",
    items: [
      ["Overview", StrawHatIcon],
      ["My courses", TreasureMapIcon],
      ["AI first mate", SnailPhoneIcon],
      ["Grand Line map", LogPoseIcon],
      ["Resource library", TreasureChestIcon],
    ],
  },
  {
    section: "TRAINING DECK",
    items: [
      ["Flashcards", VivreCardIcon],
      ["Quizzes", ThreeSwordsIcon],
      ["Captain’s notes", CaptainLogIcon],
      ["My progress", BountyPosterIcon],
    ],
  },
] as const;

function Hat({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 70"
      fill="none"
      aria-hidden="true"
    >
      <ellipse
        cx="50"
        cy="48"
        rx="45"
        ry="14"
        fill="#e8bd68"
        stroke="#72522e"
        strokeWidth="2"
      />
      <path
        d="M23 44C24 5 75 5 77 44Q52 61 23 44"
        fill="#f4d18a"
        stroke="#72522e"
        strokeWidth="2"
      />
      <path d="M24 35Q50 47 76 35L77 44Q50 57 23 44Z" fill="#b95543" />
      <path
        d="M34 22L32 32M42 17L41 35M53 15L53 37M64 20L66 34"
        stroke="#d2a359"
        strokeWidth="1.5"
      />
    </svg>
  );
}
function ModalFrame({
  title,
  subtitle,
  children,
  close,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current
      ?.querySelector<HTMLElement>("input,button,select,textarea")
      ?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const all = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea,a[href]",
        );
        if (!all?.length) return;
        if (e.shiftKey && document.activeElement === all[0]) {
          e.preventDefault();
          all[all.length - 1].focus();
        } else if (
          !e.shiftKey &&
          document.activeElement === all[all.length - 1]
        ) {
          e.preventDefault();
          all[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [close]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          className="icon-button modal-close"
          onClick={close}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        <span className="eyebrow">
          <Compass size={14} /> CHART SOMETHING NEW
        </span>
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
  children,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
function Markdown({ children }: any) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {children}
    </ReactMarkdown>
  );
}
function ThinkingTrail() {
  const steps = [
    "Reading your question",
    "Checking the Log Pose for relevant sources",
    "Choosing the fastest available AI route",
    "Building a clear answer",
  ];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setActive((value) => Math.min(value + 1, steps.length - 1)),
      1800,
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="thinking-trail" role="status">
      <span className="thinking-pulse">
        <Sparkles size={16} />
      </span>
      <div>
        <strong>First mate is working</strong>
        {steps.map((step, index) => (
          <small
            key={step}
            className={
              index === active ? "active" : index < active ? "done" : ""
            }
          >
            {index < active ? (
              <Check size={11} />
            ) : index === active ? (
              <Loader2 className="spin" size={11} />
            ) : (
              <i />
            )}
            {step}
          </small>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [courses, setCourses] = useState<Course[]>([]),
    [resources, setResources] = useState<Resource[]>([]),
    [cards, setCards] = useState<Card[]>([]),
    [topics, setTopics] = useState<Topic[]>([]),
    [quizzes, setQuizzes] = useState<Quiz[]>([]),
    [notes, setNotes] = useState<Note[]>([]);
  const [progress, setProgress] = useState<any>(emptyProgress),
    [models, setModels] = useState<any>(null);
  const [online, setOnline] = useState<boolean | null>(null),
    [busy, setBusy] = useState(""),
    [toast, setToast] = useState(""),
    [error, setError] = useState("");
  const [modal, setModal] = useState<Modal>(null),
    [mobileNav, setMobileNav] = useState(false);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null),
    [lessonIndex, setLessonIndex] = useState(0),
    [sourcePreview, setSourcePreview] = useState<Resource | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null),
    [answers, setAnswers] = useState<Record<string, number>>({});
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [cardIndex, setCardIndex] = useState(0),
    [reviewed, setReviewed] = useState<string[]>([]),
    [randomCard, setRandomCard] = useState<Card | null>(null),
    [cardTopicFilter, setCardTopicFilter] = useState("All concepts");
  const [topicFilter, setTopicFilter] = useState("All topics"),
    [query, setQuery] = useState(""),
    [searchResults, setSearchResults] = useState<any[]>([]),
    [searchRan, setSearchRan] = useState(false);
  const [chat, setChat] = useState<any[]>([]),
    [input, setInput] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null),
    [noteTitle, setNoteTitle] = useState(""),
    [noteBody, setNoteBody] = useState(""),
    [noteTopic, setNoteTopic] = useState("General");
  const [sound, setSound] = useState(
    localStorage.getItem("intellora-sound") === "true",
  );
  const [status, setStatus] = useState<any>(null),
    [onboarding, setOnboarding] = useState<any>(null),
    [graph, setGraph] = useState<any>(null),
    [courseJob, setCourseJob] = useState<CourseJob | null>(null),
    [jobVisible, setJobVisible] = useState(false);
  const chatBottom = useRef<HTMLDivElement>(null);
  const closeModal = useCallback(() => setModal(null), []);
  const notify = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 4500);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [c, r, f, t, p, q, n, m] = await Promise.all([
        api("/courses"),
        api("/resources"),
        api("/flashcards"),
        api("/knowledge/topics"),
        api("/progress"),
        api("/quizzes"),
        api("/notes"),
        api("/settings/models"),
      ]);
      setCourses(c);
      setResources(r);
      setCards(f);
      setTopics(t);
      setProgress(p);
      setQuizzes(q);
      setNotes(n);
      setModels(m);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    api("/tutor/history")
      .then(setChat)
      .catch(() => {});
    api("/settings/onboarding").then(setOnboarding).catch(()=>{});
  }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!online || resources.some((r) => r.status === "processing"))
        void refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [resources, online, refresh]);
  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onmessage = (e) => setStatus(JSON.parse(e.data));
    return () => source.close();
  }, []);
  useEffect(() => {
    localStorage.setItem("intellora-sound", String(sound));
  }, [sound]);
  useEffect(() => {
    if (!courseJob || courseJob.status === "failed") return;
    let stopped = false;
    const finish = async (completed: CourseJob) => {
      if (!completed.course_id) return;
      const ready = await api<Course>(`/courses/${completed.course_id}`);
      await refresh();
      if (!stopped) {
        setCourseJob(null);
        setJobVisible(false);
        openCourse(ready);
        notify(`Your complete ${completed.topic} course is ready.`);
      }
    };
    const poll = async () => {
      try {
        const next = await api<CourseJob>(`/courses/jobs/${courseJob.id}`);
        if (stopped) return;
        if (next.status === "done" && next.course_id) {
          await finish(next);
        } else setCourseJob(next);
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error ? e.message : "Could not read course progress.",
          );
      }
    };
    if (courseJob.status === "done")
      void finish(courseJob).catch((e) => {
        if (!stopped)
          setError(
            e instanceof Error
              ? e.message
              : "Could not open the completed course.",
          );
      });
    else void poll();
    const timer =
      courseJob.status === "done"
        ? undefined
        : window.setInterval(() => void poll(), 2500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [courseJob?.id, courseJob?.status, refresh, notify]);
  useEffect(() => {
    chatBottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat, busy]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setModal("search");
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
  function cue(event: SoundEvent) {
    if (sound) playCue(event);
  }
  function navigate(next: Page) {
    setPage(next);
    setMobileNav(false);
    setActiveCourse(null);
    setActiveQuiz(null);
    setError("");
    setTopicFilter("All topics");
  }
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy("");
    }
  }
  function openCourse(course: Course) {
    setActiveCourse(course);
    setLessonIndex(
      Math.max(
        0,
        course.lessons.findIndex((l) => !l.completed),
      ),
    );
    setPage("My courses");
  }
  const openGraphSelection = useCallback((selection: any) => {
    if (selection.kind === "note") {
      const note = notes.find((item) => item.id === selection.id);
      if (note) {
        setSelectedNote(note); setNoteTitle(note.title); setNoteBody(note.content); setNoteTopic(note.topic || "General"); setPage("Captain’s notes");
      }
      return;
    }
    const course = courses.find((item) => item.topic === selection.topic || item.topic === selection.label);
    if (course) {
      const index = course.lessons.findIndex((lesson) => `${lesson.title} ${lesson.content}`.toLowerCase().includes(String(selection.label).toLowerCase()));
      setActiveCourse(course); setLessonIndex(Math.max(0,index)); setPage("My courses");
      return;
    }
    setQuery(selection.label); setSearchResults([]); setSearchRan(false); setModal("search");
  }, [courses, notes]);
  const inProgress =
    courses.find((c) => c.progress > 0 && c.progress < 100) ||
    courses.find((c) => c.progress < 100) ||
    courses[0];
  const cardSubtopics = Array.from(
    new Set(
      cards
        .filter((c) => topicFilter === "All topics" || c.topic === topicFilter)
        .map((c) => c.subtopic)
        .filter(Boolean),
    ),
  ).sort();
  const cardPool = cards.filter(
    (c) =>
      (topicFilter === "All topics" || c.topic === topicFilter) &&
      (cardTopicFilter === "All concepts" || c.subtopic === cardTopicFilter),
  );
  const due = cardPool.filter(
    (c) =>
      c.next_review <= new Date().toLocaleDateString("en-CA") &&
      !reviewed.includes(c.id),
  );
  const currentCard = randomCard || due[cardIndex % Math.max(1, due.length)];
  const filteredCourses = courses.filter(
    (c) => topicFilter === "All topics" || c.topic === topicFilter,
  );
  const filteredResources = resources.filter(
    (r) =>
      (topicFilter === "All topics" || r.topic === topicFilter) &&
      r.title.toLowerCase().includes(query.toLowerCase()),
  );
  const filteredQuizzes = quizzes.filter(q => topicFilter === "All topics" || q.topic === topicFilter);
  const quizGroups = Object.entries(filteredQuizzes.reduce<Record<string,Quiz[]>>((groups,quiz)=>{(groups[quiz.topic] ||= []).push(quiz);return groups;},{}));

  async function ask(text = input) {
    if (!text.trim() || busy) return;
    setInput("");
    setPage("AI first mate");
    setChat((previous) => [...previous, { role: "user", content: text }]);
    await run("Your first mate is thinking…", async () => {
      const result = await post("/tutor/ask", {
        question: text,
        topic: topicFilter === "All topics" ? null : topicFilter,
      });
      setChat((previous) => [
        ...previous,
        {
          role: "assistant",
          content: result.answer,
          citations: result.citations,
          generation: result.generation,
        },
      ]);
      await refresh();
    });
  }
  async function newChat() {
    await run("Opening a fresh chat…", async () => {
      await api("/tutor/history", { method: "DELETE" });
      setChat([]);
      setInput("");
      notify("Fresh chat ready.");
    });
  }
  async function gradeCard(correct: boolean) {
    await run("Logging your progress…", async () => {
      await post(`/flashcards/${currentCard.id}/answer`, { correct });
      setReviewed((r) => [...r, currentCard.id]);
      setRandomCard(null);
      setCardIndex(0);
      cue(correct ? "correct" : "wrong");
      await refresh();
      notify(
        correct
          ? "Marked understood. This concept will return later."
          : "Saved for another look tomorrow.",
      );
    });
  }
  async function searchShip(term = query) {
    const clean = term.trim();
    if (!clean) return;
    setQuery(clean);
    setSearchRan(false);
    await run("Searching every lesson and resource…", async () => {
      setSearchResults(
        await api(`/knowledge/search?q=${encodeURIComponent(clean)}`),
      );
      setSearchRan(true);
    });
  }
  function learnRandom() {
    if (!cardPool.length) {
      notify("No learning cards match these filters yet.");
      return;
    }
    const alternatives = cardPool.filter((card) => card.id !== currentCard?.id);
    const pool = alternatives.length ? alternatives : cardPool;
    setRandomCard(pool[Math.floor(Math.random() * pool.length)]);
    setCardIndex(0);
  }
  async function removeCourse(course: Course) {
    if (
      !window.confirm(
        `Delete “${course.title}” and all of its lessons, flashcards, and quizzes?`,
      )
    )
      return;
    await run("Removing course…", async () => {
      await api(`/courses/${course.id}`, { method: "DELETE" });
      if (activeCourse?.id === course.id) setActiveCourse(null);
      await refresh();
      notify(`${course.title} was deleted.`);
    });
  }
  async function completeLesson(lesson: Lesson) {
    await run("Saving your voyage…", async () => {
      const result = await post<Course>(`/lessons/${lesson.id}/complete`);
      setActiveCourse(result);
      await refresh();
      if (result.progress === 100) {
        cue("complete");
        notify("Course complete. Another island conquered!");
      } else {
        cue("correct");
        setLessonIndex((i) => Math.min(i + 1, result.lessons.length - 1));
      }
    });
  }
  const sectionHeading = (
    eyebrow: string,
    title: string,
    text: string,
    action?: ReactNode,
  ) => (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
  const topicSelect = (
    <label className="select-wrapper">
      <select
        aria-label="Filter by topic"
        value={topicFilter}
        onChange={(e) => {
          setTopicFilter(e.target.value);
          setCardIndex(0);
          setRandomCard(null);
          setCardTopicFilter("All concepts");
        }}
      >
        <option>All topics</option>
        {topics.map((t) => (
          <option key={t.id}>{t.name}</option>
        ))}
      </select>
      <ChevronDown size={14} />
    </label>
  );
  const courseCard = (course: Course, i: number) => (
    <article className={`course-card ${course.color}`} key={course.id}>
      <button className="course-card-open" onClick={() => openCourse(course)}>
        <div className="course-art">
          <span className="course-island">
            ISLAND {String(i + 1).padStart(2, "0")}
          </span>
          <div className="island-lines" />
          <span className="course-symbol">
            {course.topic.toLowerCase().includes("python") ? (
              <span className="code-symbol">{"{ }"}</span>
            ) : course.topic.includes("Machine") ? (
              <DevilFruitIcon size={56} strokeWidth={1.2} />
            ) : (
              <TreasureChestIcon size={56} strokeWidth={1.2} />
            )}
          </span>
          <span className="art-compass">✧</span>
          <span className="difficulty">{course.difficulty}</span>
        </div>
        <div className="course-card-body">
          <span className="course-topic">{course.topic}</span>
          <h3>{course.title}</h3>
          <p>
            {course.lesson_count} lessons <span>·</span> Self-paced
          </p>
          <div className="progress-line">
            <span style={{ width: `${course.progress}%` }} />
          </div>
          <div className="course-card-footer">
            <span>
              {course.progress
                ? `${course.progress}% explored`
                : "Ready to explore"}
            </span>
            <span>
              {course.progress ? "Continue" : "Set sail"}{" "}
              <ArrowRight size={14} />
            </span>
          </div>
        </div>
      </button>
      <button
        className="course-delete"
        onClick={() => void removeCourse(course)}
        aria-label={`Delete ${course.title}`}
        title="Delete course"
      >
        <Trash2 size={16} />
      </button>
    </article>
  );

  return (
    <div className="app-shell">
      {mobileNav && (
        <div className="nav-scrim" onClick={() => setMobileNav(false)} />
      )}
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <button className="brand" onClick={() => navigate("Overview")}>
          <img
            className="brand-mark"
            src="/assets/intellora-logo.png"
            alt="Intellora compass and straw-hat mark"
          />
          <div>
            <strong>
              intellora<span>.</span>
            </strong>
            <small>LEARNING IS AN ADVENTURE</small>
          </div>
        </button>
        <details className="crew-menu">
          <summary className="crew-card">
            <div className="avatar">
              <Hat />
            </div>
            <div>
              <strong>Captain Kanishka</strong>
              <span>
                <span className="tiny-dot" /> Straw Hat Scholar
              </span>
            </div>
            <ChevronDown size={14} />
          </summary>
          <div className="crew-dropdown">
            <button onClick={() => navigate("Overview")}>
              <Compass size={16} />
              <span>
                <strong>Captain’s bridge</strong>
                <small>Return to your overview</small>
              </span>
            </button>
            <button onClick={() => navigate("Captain’s notes")}>
              <NotebookPen size={16} />
              <span>
                <strong>Captain’s log</strong>
                <small>Open your saved notes</small>
              </span>
            </button>
            <button onClick={() => navigate("Settings")}>
              <Settings2 size={16} />
              <span>
                <strong>Ship settings</strong>
                <small>AI, sound, privacy, and storage</small>
              </span>
            </button>
            <button onClick={() => setModal("share")}>
              <Share2 size={16} />
              <span>
                <strong>Invite a crewmate</strong>
                <small>Share a clean copy with a friend</small>
              </span>
            </button>
          </div>
        </details>
        <nav aria-label="Main navigation">
          {nav.map((group) => (
            <div className="nav-group" key={group.section}>
              <span className="nav-label">{group.section}</span>
              {group.items.map(([name, Icon]) => (
                <button
                  key={name}
                  className={`nav-item ${page === name ? "active" : ""}`}
                  onClick={() => navigate(name)}
                >
                  <Icon size={19} strokeWidth={1.65} />
                  <span>{name}</span>
                  {name === "Flashcards" && progress.due_cards > 0 && (
                    <small>{progress.due_cards}</small>
                  )}
                  {name === "AI first mate" && (
                    <span className="ai-tag">AI</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="voyage-note">
            <Ship size={24} strokeWidth={1.4} />
            <p>
              Big dreams.
              <br />
              <strong>One lesson at a time.</strong>
            </p>
            <span className="tiny-star">✧</span>
          </div>
          <button
            className={`nav-item ${page === "Settings" ? "active" : ""}`}
            onClick={() => navigate("Settings")}
          >
            <Settings2 size={18} /> Settings & sound
          </button>
          <div className="local-status">
            <span className={`tiny-dot ${online === false ? "offline" : ""}`} />
            {online === null
              ? "Connecting to your ship…"
              : online
                ? "Your ship. Your data."
                : "Backend is offline"}
            <span>LOCAL FIRST</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <Ship size={17} />
            <span>Your ship</span>
            <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="search-button"
              aria-label="Search lessons and resources"
              title="Search every generated lesson and library resource"
              onClick={() => {
                setQuery("");
                setSearchResults([]);
                setSearchRan(false);
                setModal("search");
              }}
            >
              <Search size={16} />
              <span>Search lessons & resources</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="header-divider" />
            <button
              className="icon-button"
              onClick={() => setSound((s) => !s)}
              title={sound ? "Mute sounds" : "Enable sounds"}
              aria-label={sound ? "Mute sounds" : "Enable sounds"}
            >
              {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
            <button
              className="icon-button notification-button"
              onClick={() => setModal("reminders")}
              aria-label="Study reminders"
            >
              <Bell size={19} />
              {progress.due_cards > 0 && <i />}
            </button>
            <button
              className="profile-avatar"
              onClick={() => navigate("Settings")}
              aria-label="Open profile settings"
            >
              K
            </button>
          </div>
        </header>
        <main>
          {online === false && (
            <div className="connection-banner">
              <Anchor size={18} />
              <span>
                The backend is offline. Run <code>.\start.ps1</code> from the
                project folder to reconnect.
              </span>
              <button onClick={() => void refresh()}>Retry</button>
            </div>
          )}
          {online && onboarding && !onboarding.hosted && (!onboarding.ollama_online || !onboarding.installed_models.length) && <div className="connection-banner local-setup"><Cpu size={18}/><span><strong>Prepare your local first mate.</strong> This computer is best matched with <code>{onboarding.recommended_model}</code>. Start Ollama and run <code>{onboarding.pull_command}</code>.</span><button onClick={()=>navigate("Settings")}>Open setup</button></div>}
          {error && (
            <div className="error-banner" role="alert">
              <CircleHelp size={18} />
              <span>{error}</span>
              <button
                className="icon-button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {status?.state === "error" && !error && (
            <div className="status-banner">
              <CircleHelp size={16} />
              {status.message}
            </div>
          )}
          {status?.state === "pulling" || status?.state === "embedding" ? (
            <div className="status-banner">
              <Loader2 className="spin" size={16} />
              {status.message}
              {status.total > 0 && (
                <progress value={status.completed} max={status.total} />
              )}
            </div>
          ) : null}

          {page === "Overview" && (
            <>
              <div className="greeting">
                <div>
                  <div className="date-label">
                    <span className="tiny-line" />
                    {new Date()
                      .toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })
                      .toUpperCase()}
                  </div>
                  <h1>
                    Welcome aboard, Kanishka{" "}
                    <span className="greeting-sun">☀</span>
                  </h1>
                  <p>A new day. A new island of knowledge to explore.</p>
                </div>
                <button
                  className="button outline"
                  onClick={() => setModal("upload")}
                >
                  <Plus size={16} /> Add knowledge
                </button>
              </div>
              <section className="hero">
                <div className="hero-art" />
                <div className="hero-content">
                  <span className="hero-kicker">
                    <span /> YOUR GRAND LINE STARTS HERE
                  </span>
                  <h2>
                    A little wiser.
                    <br />A little <em>further.</em>
                  </h2>
                  <p>
                    You don’t need to see the whole ocean.
                    <br />
                    Just take the next step in your learning voyage.
                  </p>
                  <button
                    className="button primary"
                    onClick={() =>
                      inProgress
                        ? openCourse(inProgress)
                        : setModal("generate-course")
                    }
                  >
                    Continue your journey <ArrowRight size={17} />
                  </button>
                  <span className="hero-footnote">
                    <Compass size={13} /> Your curiosity is your compass.
                  </span>
                </div>
                <span className="hero-coordinate">
                  23° 26′ N &nbsp; · &nbsp; ENDLESS POSSIBILITIES
                </span>
                <div className="hero-stamp">
                  <Anchor size={18} />
                  <span>
                    THE GRAND
                    <br />
                    LEARNING LINE
                  </span>
                </div>
              </section>
              <div className="stats-grid">
                <Stat
                  icon={<Flame />}
                  color="orange"
                  value={`${progress.streak} ${progress.streak === 1 ? "day" : "days"}`}
                  title="Learning streak"
                  detail={
                    progress.streak
                      ? "Keep the fire alive"
                      : "Your adventure starts today"
                  }
                />
                <Stat
                  icon={<BookOpen />}
                  color="green"
                  value={String(courses.filter((c) => c.progress < 100).length)}
                  title="Courses on your horizon"
                  detail={`${courses.filter((c) => c.progress === 100).length} islands conquered`}
                />
                <Stat
                  icon={<Layers3 />}
                  color="purple"
                  value={String(progress.due_cards)}
                  title="Cards ready to review"
                  detail="A little practice goes a long way"
                />
                <Stat
                  icon={<Flag />}
                  color="gold"
                  value={progress.xp.toLocaleString()}
                  title="Total bounty · XP"
                  detail={
                    progress.xp
                      ? "Earned with every discovery"
                      : "Your first treasure awaits"
                  }
                />
              </div>
              <div className="dashboard-columns">
                <div className="dashboard-main">
                  <section className="section">
                    <div className="section-title">
                      <div>
                        <h2>
                          Your next islands{" "}
                          <span className="count-pill">{courses.length}</span>
                        </h2>
                        <p>Good things happen when you keep going.</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => navigate("My courses")}
                      >
                        All courses <ArrowRight size={15} />
                      </button>
                    </div>
                    <div className="course-grid">
                      {courses.slice(0, 3).map(courseCard)}
                      {courses.length === 0 && (
                        <button
                          className="new-course-card"
                          onClick={() => setModal("generate-course")}
                        >
                          <Plus /> Chart your first course
                        </button>
                      )}
                    </div>
                  </section>
                  <section className="section quick-section">
                    <div className="section-title">
                      <div>
                        <h2>A little help from your crew</h2>
                        <p>Everything you need to make knowledge stick.</p>
                      </div>
                      <Sparkles size={19} />
                    </div>
                    <div className="quick-grid">
                      <button onClick={() => navigate("AI first mate")}>
                        <span className="quick-icon green">
                          <Sparkles size={23} />
                        </span>
                        <div>
                          <h3>Ask your first mate</h3>
                          <p>Untangle a tricky concept.</p>
                        </div>
                        <ArrowRight size={17} />
                      </button>
                      <button onClick={() => navigate("Quizzes")}>
                        <span className="quick-icon orange">
                          <Swords size={23} />
                        </span>
                        <div>
                          <h3>Test your sea legs</h3>
                          <p>A small challenge. A big leap.</p>
                        </div>
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  </section>
                  <section className="section">
                    <div className="section-title">
                      <div>
                        <h2>Your treasure chest</h2>
                        <p>Every resource is a new possibility.</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => navigate("Resource library")}
                      >
                        Open library <ArrowRight size={15} />
                      </button>
                    </div>
                    {resources.length ? (
                      <div className="resource-list">
                        {resources.slice(0, 3).map((r) => (
                          <ResourceRow
                            key={r.id}
                            resource={r}
                            onClick={() =>
                              void run("Opening resource…", async () =>
                                setSourcePreview(
                                  await api(`/resources/${r.id}`),
                                ),
                              )
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <button
                        className="upload-strip"
                        onClick={() => setModal("upload")}
                      >
                        <span>
                          <UploadCloud size={25} />
                        </span>
                        <div>
                          <strong>Bring your knowledge aboard</strong>
                          <p>
                            Drop in a PDF, your notes, a link, or a little
                            curiosity.
                          </p>
                        </div>
                        <Plus size={20} />
                      </button>
                    )}
                  </section>
                </div>
                <aside className="dashboard-aside">
                  <section className="goal-card">
                    <div className="small-card-title">
                      <span>
                        <Target size={16} /> TODAY’S HEADING
                      </span>
                      <span>✧</span>
                    </div>
                    <div
                      className="goal-ring"
                      style={
                        {
                          "--goal": `${Math.min(100, progress.today_xp)}%`,
                        } as any
                      }
                    >
                      <div>
                        <span>
                          {Math.min(100, progress.today_xp)}
                          <small>/100</small>
                        </span>
                        <p>DAILY XP</p>
                      </div>
                    </div>
                    <h3>
                      {progress.today_xp >= 100
                        ? "A fine day at sea."
                        : "Small steps. Stronger you."}
                    </h3>
                    <p>
                      {progress.today_xp >= 100
                        ? "Daily goal complete. Take a well-earned breath."
                        : "Just one lesson can move you closer to your daily goal."}
                    </p>
                    <div className="week-dots">
                      {Array.from({ length: 7 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - 6 + i);
                        return (
                          <div key={i}>
                            <span>
                              {d.toLocaleDateString("en", {
                                weekday: "narrow",
                              })}
                            </span>
                            <i
                              className={
                                progress.weekly[i]?.xp > 0
                                  ? "done"
                                  : i === 6
                                    ? "today"
                                    : ""
                              }
                            >
                              {progress.weekly[i]?.xp > 0 ? (
                                <Check size={12} />
                              ) : (
                                "·"
                              )}
                            </i>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <button
                    className="review-card"
                    onClick={() => navigate("Flashcards")}
                  >
                    <div className="review-card-top">
                      <span className="mini-cards">
                        <Layers3 size={26} />
                      </span>
                      <span className="pill">{progress.due_cards} DUE</span>
                    </div>
                    <h3>
                      A quick memory
                      <br />
                      expedition?
                    </h3>
                    <p>
                      Revisit a few ideas.
                      <br />
                      Make them yours for good.
                    </p>
                    <span className="text-button">
                      Review flashcards <ArrowRight size={16} />
                    </span>
                  </button>
                  <div className="quote-card">
                    <Hat />
                    <p>
                      “The best treasure is
                      <br />
                      what you learn along the way.”
                    </p>
                    <span>A NOTE FROM YOUR CREW</span>
                  </div>
                </aside>
              </div>
              <footer className="dashboard-footer">
                <Anchor size={13} /> Made for curious minds and uncharted
                waters.<span>ONE LESSON CLOSER.</span>
              </footer>
            </>
          )}

          {page === "My courses" && !activeCourse && (
            <>
              {sectionHeading(
                "CHART YOUR COURSE",
                "A whole ocean of possibilities.",
                "Choose an island. Follow your curiosity. Make it yours.",
                <button
                  className="button primary"
                  onClick={() => setModal("generate-course")}
                >
                  <Plus size={17} /> Create a course
                </button>,
              )}
              <div className="filter-bar">
                {topicSelect}
                <span>{filteredCourses.length} courses in your voyage</span>
              </div>
              <div className="course-grid large">
                {filteredCourses.map(courseCard)}
              </div>
            </>
          )}
          {page === "My courses" && activeCourse && (
            <>
              <button
                className="text-button back-button"
                onClick={() => setActiveCourse(null)}
              >
                <ArrowLeft size={16} /> Back to your courses
              </button>
              {sectionHeading(
                activeCourse.topic.toUpperCase(),
                activeCourse.title,
                `${activeCourse.completed_lessons} of ${activeCourse.lesson_count} lessons explored`,
                activeCourse.lesson_count < 8 ? (
                  <button
                    className="button primary"
                    disabled={!!courseJob}
                    onClick={() =>
                      void run("Starting the complete edition…", async () => {
                        setCourseJob(
                          await post<CourseJob>("/courses/generate", {
                            topic: activeCourse.topic,
                            difficulty: activeCourse.difficulty,
                          }),
                        );
                        setJobVisible(true);
                      })
                    }
                  >
                    <Sparkles size={16} /> Expand to complete course
                  </button>
                ) : undefined,
              )}
              <div className="lesson-layout">
                <aside className="lesson-nav">
                  <h3>
                    <Map size={17} /> Your course map
                  </h3>
                  {activeCourse.lessons.map((lesson, i) => (
                    <button
                      key={lesson.id}
                      className={lessonIndex === i ? "selected" : ""}
                      onClick={() => setLessonIndex(i)}
                    >
                      <span>
                        {lesson.completed ? (
                          <Check size={15} />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                      {lesson.title}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      navigate("Flashcards");
                      setTopicFilter(activeCourse.topic);
                    }}
                  >
                    <Layers3 size={18} /> Course flashcards
                  </button>
                  <button
                    onClick={() => {
                      const q = quizzes.find(
                        (q) => q.topic === activeCourse.topic && !q.submitted,
                      );
                      navigate("Quizzes");
                      if (q) {
                        setActiveQuiz(q);
                        setAnswers({});
                      }
                    }}
                  >
                    <Swords size={18} /> Test your knowledge
                  </button>
                </aside>
                <article className="lesson-body">
                  <span className="eyebrow">
                    LESSON {lessonIndex + 1} · {activeCourse.difficulty}
                  </span>
                  <h2>{activeCourse.lessons[lessonIndex]?.title}</h2>
                  {activeCourse.lessons[lessonIndex] && (
                    <LessonVisual
                      topic={activeCourse.topic}
                      title={activeCourse.lessons[lessonIndex].title}
                      content={activeCourse.lessons[lessonIndex].content}
                    />
                  )}
                  <div className="markdown">
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {activeCourse.lessons[lessonIndex]?.content || ""}
                    </Markdown>
                  </div>
                  <div className="lesson-footer">
                    <button
                      className="button outline"
                      onClick={() =>
                        void ask(
                          `Explain this lesson with a simpler example: ${activeCourse.lessons[lessonIndex].content}`,
                        )
                      }
                    >
                      <Sparkles size={16} /> Ask first mate
                    </button>
                    <button
                      className="button primary"
                      disabled={
                        !!busy || activeCourse.lessons[lessonIndex]?.completed
                      }
                      onClick={() =>
                        void completeLesson(activeCourse.lessons[lessonIndex])
                      }
                    >
                      {activeCourse.lessons[lessonIndex]?.completed ? (
                        <>
                          <CheckCircle2 size={17} /> Completed
                        </>
                      ) : (
                        <>
                          Mark complete <ArrowRight size={17} />
                        </>
                      )}
                    </button>
                  </div>
                </article>
              </div>
            </>
          )}

          {page === "AI first mate" && (
            <div className="chat-page">
              {sectionHeading(
                "YOUR PERSONAL AI TUTOR",
                "A first mate for your mind.",
                "Ask freely. Learn deeply. Keep your curiosity afloat.",
                <div className="heading-actions">{topicSelect}<button className="button outline" disabled={!!busy} onClick={()=>void newChat()}><Plus size={16}/> New chat</button></div>,
              )}
              <div className="chat-messages">
                {chat.length === 0 && (
                  <div className="chat-welcome">
                    <div className="tutor-logo">
                      <Sparkles size={35} />
                    </div>
                    <h2>Where shall we sail today?</h2>
                    <p>
                      A concept that won’t click? A question you’ve been saving?
                      <br />
                      Let’s work through it together.
                    </p>
                    <div className="suggestions">
                      {[
                        "Explain Python functions with an analogy",
                        "How do I avoid overfitting?",
                        "Help me understand SQL joins",
                      ].map((t) => (
                        <button key={t} onClick={() => void ask(t)}>
                          {t}
                          <ArrowRight size={16} />
                        </button>
                      ))}
                    </div>
                    <span className="muted">
                      Upload your materials for answers grounded in your own
                      sources.
                    </span>
                  </div>
                )}
                {chat.map((m, i) => (
                  <div className={`message ${m.role}`} key={m.id || i}>
                    <div className="message-avatar">
                      {m.role === "user" ? "K" : <Sparkles size={19} />}
                    </div>
                    <div className="message-content">
                      <strong>
                        {m.role === "user"
                          ? "You"
                          : "Intellora · Your first mate"}
                      </strong>
                      <div className="markdown">
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </Markdown>
                      </div>
                      {m.citations?.length > 0 && (
                        <div className="citations">
                          {m.citations.map((c: any) => (
                            <button
                              key={c.id}
                              onClick={() =>
                                void run("Opening source…", async () =>
                                  setSourcePreview(
                                    await api(`/resources/${c.source_id}`),
                                  ),
                                )
                              }
                            >
                              <FileText size={12} />[{c.number}] {c.title}
                            </button>
                          ))}
                        </div>
                      )}
                      {m.role === "assistant" && (
                        <div className="message-tools">
                          {m.generation && <span className="generation-badge"><Cpu size={13}/>{m.generation.local ? "Local" : "Cloud"} · {m.generation.provider} · {m.generation.model} · {(m.generation.latency_ms/1000).toFixed(1)}s</span>}
                          <button
                            onClick={() => {
                              void navigator.clipboard
                                .writeText(m.content)
                                .then(() => notify("Copied to clipboard"))
                                .catch(() =>
                                  setError(
                                    "Clipboard unavailable in this browser.",
                                  ),
                                );
                            }}
                          >
                            <Copy size={13} /> Copy
                          </button>
                          <button
                            onClick={() =>
                              void run("Saving note…", async () => {
                                await post("/notes", {
                                  title: "A note from your first mate",
                                  content: m.content,
                                });
                                await refresh();
                                notify("Saved to Captain’s notes");
                              })
                            }
                          >
                            <NotebookPen size={13} /> Save as note
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {busy && <ThinkingTrail />}
                <div ref={chatBottom} />
              </div>
              <form
                className="chat-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask();
                }}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void ask();
                    }
                  }}
                  placeholder="Ask anything. Every great voyage starts with a question…"
                  rows={2}
                  aria-label="Message your AI tutor"
                />
                <div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setModal("upload")}
                    aria-label="Add a source"
                  >
                    <Plus size={20} />
                  </button>
                  <span>
                    <span className="tiny-dot" />{" "}
                    {models?.provider === "auto" ? "Ollama first · cloud fallback" : `${models?.provider || "Ollama"} selected`}
                  </span>
                  <button
                    className="send-button"
                    type="submit"
                    disabled={!!busy || !input.trim()}
                    aria-label="Send message"
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>
              </form>
              <p className="chat-disclaimer">
                A helpful crewmate, not an infallible one. Check important
                details against your sources.
              </p>
            </div>
          )}

          {page === "Resource library" && (
            <>
              {sectionHeading(
                "YOUR TREASURE CHEST",
                "Good knowledge travels with you.",
                "Your notes, documents, and discoveries. All in one place.",
                <button
                  className="button primary"
                  onClick={() => setModal("upload")}
                >
                  <Plus size={17} /> Add resource
                </button>,
              )}
              <div className="filter-bar">
                <div className="input-with-icon">
                  <Search size={17} />
                  <input
                    placeholder="Search your resources…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                {topicSelect}
                <span>{resources.length} resources aboard</span>
              </div>
              <div className="panel">
                {filteredResources.length ? (
                  filteredResources.map((r) => (
                    <div className="resource-with-actions" key={r.id}>
                      <ResourceRow
                        resource={r}
                        onClick={() =>
                          void run("Opening resource…", async () =>
                            setSourcePreview(await api(`/resources/${r.id}`)),
                          )
                        }
                      />
                      {r.status === "error" && (
                        <button
                          className="text-button"
                          disabled={!!busy}
                          onClick={() =>
                            void run("Retrying resource…", async () => {
                              await post(
                                `/knowledge/process?source_id=${r.id}`,
                              );
                              await refresh();
                            })
                          }
                        >
                          Retry
                        </button>
                      )}
                      <button
                        className="icon-button"
                        disabled={r.status === "processing"}
                        aria-label={`Delete ${r.title}`}
                        onClick={() =>
                          void run("Removing resource…", async () => {
                            await api(`/resources/${r.id}`, {
                              method: "DELETE",
                            });
                            await refresh();
                            notify("Resource removed");
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <Empty
                    icon={<Library size={38} />}
                    title="There’s room for your discoveries."
                    text="Add a PDF, notes, a website, or a YouTube transcript to start building your personal knowledge base."
                  >
                    <button
                      className="button primary"
                      onClick={() => setModal("upload")}
                    >
                      <UploadCloud size={17} /> Bring something aboard
                    </button>
                  </Empty>
                )}
              </div>
              <div className="info-note">
                <Anchor size={16} /> Your documents stay on this computer.
                Relevant excerpts are sent to Sarvam only when cloud generation
                is used.
              </div>
            </>
          )}

          {page === "Flashcards" && (
            <>
              {sectionHeading(
                "THE LEARNING DECK",
                "Understand one useful concept at a time.",
                "Open a focused reference card, follow its sources, or let Intellora choose something unexpected.",
                <div className="heading-actions">
                  <button className="button outline" onClick={learnRandom}>
                    <Compass size={16} /> Learn something random
                  </button>
                  <button
                    className="button primary"
                    onClick={() => setModal("generate-cards")}
                  >
                    <Sparkles size={16} /> Create learning cards
                  </button>
                </div>,
              )}
              <div className="filter-bar">
                {topicSelect}
                <label className="select-wrapper">
                  <select
                    aria-label="Filter by specific concept"
                    value={cardTopicFilter}
                    onChange={(e) => {
                      setCardTopicFilter(e.target.value);
                      setRandomCard(null);
                      setCardIndex(0);
                    }}
                  >
                    <option>All concepts</option>
                    {cardSubtopics.map((concept) => (
                      <option key={concept}>{concept}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </label>
                <span>
                  {due.length} due · {cardPool.length} matching learning cards
                </span>
              </div>
              {currentCard ? (
                <div className="flashcard-workspace">
                  <div className="flashcard-meta">
                    <span>
                      <Layers3 size={16} /> {currentCard.topic} ·{" "}
                      {currentCard.subtopic}
                    </span>
                    <span>
                      {randomCard
                        ? "A RANDOM DISCOVERY"
                        : "LEARN · REFER · REMEMBER"}
                    </span>
                  </div>
                  <article className="flashcard learning-card">
                    <span className="eyebrow">
                      {currentCard.subtopic || "CORE CONCEPT"}
                    </span>
                    <h2>{currentCard.question}</h2>
                    <p className="card-summary">{currentCard.answer}</p>
                    {currentCard.explanation && (
                      <section>
                        <h3>Understand it</h3>
                        <div className="markdown">
                          <Markdown remarkPlugins={[remarkGfm]}>
                            {currentCard.explanation}
                          </Markdown>
                        </div>
                      </section>
                    )}
                    {currentCard.key_points?.length > 0 && (
                      <section>
                        <h3>Key points</h3>
                        <ul>
                          {currentCard.key_points.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </section>
                    )}
                    {currentCard.worked_example && (
                      <section className="card-example">
                        <h3>Concrete example</h3>
                        <div className="markdown">
                          <Markdown remarkPlugins={[remarkGfm]}>
                            {currentCard.worked_example}
                          </Markdown>
                        </div>
                      </section>
                    )}
                    {currentCard.reference_links?.length > 0 && (
                      <section className="card-references">
                        <h3>Learn more from the sources</h3>
                        <div>
                          {currentCard.reference_links.map((link, i) => (
                            <a
                              key={`${link.url}-${i}`}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Link2 size={14} />
                              {link.title}
                              <ArrowRight size={13} />
                            </a>
                          ))}
                        </div>
                      </section>
                    )}
                    <span className="card-watermark">
                      <Compass size={150} strokeWidth={0.5} />
                    </span>
                  </article>
                  <div className="review-actions">
                    <button
                      className="button outline"
                      disabled={!!busy}
                      onClick={() => void gradeCard(false)}
                    >
                      <ArrowLeft size={16} /> Refer again tomorrow
                    </button>
                    <button
                      className="button primary"
                      disabled={!!busy}
                      onClick={() => void gradeCard(true)}
                    >
                      <Check size={17} /> I understand this
                    </button>
                  </div>
                  <div className="learning-card-tools">
                    <button
                      className="text-button"
                      onClick={() => setEditingCard(currentCard)}
                    >
                      <NotebookPen size={14} /> Edit this learning card
                    </button>
                    <button className="text-button" onClick={learnRandom}>
                      <Compass size={14} /> Another random concept
                    </button>
                  </div>
                  {!randomCard && (
                    <div className="card-bubbles">
                      {due.slice(0, 12).map((c, i) => (
                        <button
                          key={c.id}
                          className={c.id === currentCard.id ? "active" : ""}
                          onClick={() => {
                            setCardIndex(i);
                            setRandomCard(null);
                          }}
                          aria-label={`Open learning card ${i + 1}`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Empty
                  icon={<CheckCircle2 size={45} />}
                  title="Your review deck is clear."
                  text="Choose Learn something random to browse any saved concept, or generate a focused set of new learning cards."
                >
                  <div className="heading-actions">
                    <button className="button outline" onClick={learnRandom}>
                      <Compass size={16} /> Learn something random
                    </button>
                    <button
                      className="button primary"
                      onClick={() => setModal("generate-cards")}
                    >
                      Create learning cards <Plus size={16} />
                    </button>
                  </div>
                </Empty>
              )}
            </>
          )}

          {page === "Quizzes" && !activeQuiz && (
            <>
              {sectionHeading(
                "TEST YOUR SEA LEGS",
                "A challenge worth taking.",
                "Find your strengths. Discover what needs another look.",
                <button
                  className="button primary"
                  onClick={() => setModal("generate-quiz")}
                >
                  <Plus size={17} /> New challenge
                </button>,
              )}
              <div className="filter-bar">{topicSelect}<span>{filteredQuizzes.length} challenges · grouped by learning island</span></div>
              {quizGroups.map(([category, categoryQuizzes]) => <section className="quiz-category" key={category}><div className="quiz-category-heading"><div><span className="eyebrow">LEARNING ISLAND</span><h2>{category}</h2></div><span>{categoryQuizzes?.length || 0} {(categoryQuizzes?.length || 0) === 1 ? "challenge" : "challenges"}</span></div><div className="quiz-grid">
                {(categoryQuizzes || []).map((q) => (
                  <button
                    className="quiz-card"
                    key={q.id}
                    onClick={() => {
                      setActiveQuiz(q);
                      setAnswers({});
                    }}
                  >
                    <span
                      className={`quiz-icon ${q.submitted ? "green" : "orange"}`}
                    >
                      {q.submitted ? (
                        <CheckCircle2 size={25} />
                      ) : (
                        <Swords size={25} />
                      )}
                    </span>
                    <span className="eyebrow">{q.topic}</span>
                    <h3>{q.title}</h3>
                    <p>{q.questions.length} questions · Learn at your pace</p>
                    <div>
                      <span>
                        {q.submitted
                          ? `Bounty earned · ${q.score}%`
                          : "Ready when you are"}
                      </span>
                      <ArrowRight size={17} />
                    </div>
                  </button>
                ))}
              </div></section>)}
            </>
          )}
          {page === "Quizzes" && activeQuiz && (
            <>
              <button
                className="text-button back-button"
                onClick={() => setActiveQuiz(null)}
              >
                <ArrowLeft size={16} /> All challenges
              </button>
              {sectionHeading(
                "A LITTLE BRAVER. A LITTLE BETTER.",
                activeQuiz.title,
                activeQuiz.submitted
                  ? `You scored ${activeQuiz.score}%. Every answer is a chance to learn.`
                  : "Choose your answers, then check your bearings.",
              )}
              {activeQuiz.submitted && (
                <div className="quiz-result">
                  <Flag size={30} />
                  <div>
                    <h2>
                      {activeQuiz.score >= 70
                        ? "Well sailed, Captain!"
                        : "Every explorer takes a wrong turn."}
                    </h2>
                    <p>
                      {activeQuiz.score >= 70
                        ? "You’ve added a little more knowledge to your treasure chest."
                        : "Review the explanations below, then try a fresh challenge."}
                    </p>
                  </div>
                  <strong>{activeQuiz.score}%</strong>
                </div>
              )}
              <div className="quiz-questions">
                {activeQuiz.questions.map((q, i) => (
                  <section className="question-card" key={q.id}>
                    <span className="eyebrow">
                      QUESTION {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3>{q.question}</h3>
                    <div className="options-grid">
                      {q.options.map((option, j) => (
                        <button
                          disabled={activeQuiz.submitted}
                          className={`${answers[q.id] === j ? "selected" : ""} ${activeQuiz.submitted && q.correct_index === j ? "correct" : ""} ${activeQuiz.submitted && answers[q.id] === j && q.correct_index !== j ? "incorrect" : ""}`}
                          key={j}
                          onClick={() =>
                            setAnswers((a) => ({ ...a, [q.id]: j }))
                          }
                        >
                          <span>{String.fromCharCode(65 + j)}</span>
                          {option}
                          {activeQuiz.submitted && q.correct_index === j && (
                            <Check size={17} />
                          )}
                        </button>
                      ))}
                    </div>
                    {activeQuiz.submitted && (
                      <div className="answer-explanation">
                        <Sparkles size={16} />
                        {q.explanation}
                      </div>
                    )}
                  </section>
                ))}
              </div>
              {!activeQuiz.submitted ? (
                <div className="quiz-submit">
                  <span>
                    {Object.keys(answers).length} of{" "}
                    {activeQuiz.questions.length} answered
                  </span>
                  <button
                    className="button primary"
                    disabled={
                      !!busy ||
                      Object.keys(answers).length !==
                        activeQuiz.questions.length
                    }
                    onClick={() =>
                      void run("Checking your bearings…", async () => {
                        const result = await post(
                          `/quizzes/${activeQuiz.id}/submit`,
                          { answers },
                        );
                        setActiveQuiz(result);
                        cue(result.score < 100 ? "wrong" : "correct");
                        await refresh();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      })
                    }
                  >
                    Check my answers <ArrowRight size={17} />
                  </button>
                </div>
              ) : (
                <button
                  className="button primary"
                  onClick={() => setModal("generate-quiz")}
                >
                  Try a new challenge <ArrowRight size={17} />
                </button>
              )}
            </>
          )}

          {page === "Grand Line map" && (
            <>
              {sectionHeading(
                "FOLLOW YOUR LOG POSE",
                "Your Grand Line map.",
                "Click any island, concept, or captain’s note to sail directly to its learning content.",
                <button
                  className="button primary"
                  disabled={!!busy}
                  onClick={() =>
                    void run("Charting your concept map…", async () => {
                      const topic =
                        topicFilter === "All topics"
                          ? topics[0]?.name
                          : topicFilter;
                      if (!topic)
                        throw new Error(
                          "Create a course or add a source to chart your first topic.",
                        );
                      setGraph(await post("/visualize", { topic }));
                    })
                  }
                >
                  <Sparkles size={16} /> Visualize a concept
                </button>,
              )}
              <div className="filter-bar">
                {topicSelect}
                <button className="text-button" onClick={() => setGraph(null)}>
                  Reset to course map
                </button>
                 <span>Click to open · Drag to explore · Scroll to zoom</span>
              </div>
              <div className="graph-panel">
                <Suspense
                  fallback={
                    <div className="empty">
                      <Loader2 className="spin" />
                      Charting your map…
                    </div>
                  }
                >
                  <KnowledgeGraphView
                    topics={topics.filter(
                      (t) =>
                        topicFilter === "All topics" || t.name === topicFilter,
                    )}
                    custom={graph}
                    notes={notes.filter(note => topicFilter === "All topics" || note.topic === topicFilter)}
                    onSelect={openGraphSelection}
                  />
                </Suspense>
                <div className="graph-legend">
                  <span>
                    <i className="green-dot" /> Your knowledge
                  </span>
                  <span>
                    <i className="gold-dot" /> Learning islands
                  </span>
                  <span>╌→ Prerequisites</span>
                </div>
              </div>
            </>
          )}

          {page === "Captain’s notes" && (
            <>
              {sectionHeading(
                "THOUGHTS WORTH KEEPING",
                "Your captain’s log.",
                "Save a spark of understanding before it sails away.",
                <button
                  className="button primary"
                  onClick={() => {
                    setSelectedNote(null);
                    setNoteTitle("");
                    setNoteBody("");
                    setNoteTopic(topicFilter === "All topics" ? "General" : topicFilter);
                  }}
                >
                  <Plus size={17} /> New note
                </button>,
              )}
              <div className="notes-layout">
                <div className="notes-list">
                  {notes.map((n) => (
                    <button
                      key={n.id}
                      className={selectedNote?.id === n.id ? "selected" : ""}
                      onClick={() => {
                        setSelectedNote(n);
                        setNoteTitle(n.title);
                        setNoteBody(n.content);
                        setNoteTopic(n.topic || "General");
                      }}
                    >
                      <NotebookPen size={17} />
                      <div>
                        <strong>{n.title}</strong>
                        <p>{n.content.slice(0, 70)}</p>
                        <small>
                          {n.topic || "General"} · {new Date(n.updated_at).toLocaleDateString()}
                        </small>
                      </div>
                    </button>
                  ))}
                  {notes.length === 0 && (
                    <p className="muted">Your first page is waiting.</p>
                  )}
                </div>
                <div className="note-editor">
                  <input
                    aria-label="Note title"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Give this thought a title…"
                  />
                  <label className="field-label note-topic">Learning island<select value={noteTopic} onChange={event=>setNoteTopic(event.target.value)}><option>General</option>{topics.map(topic=><option key={topic.id}>{topic.name}</option>)}</select></label>
                  <textarea
                    aria-label="Note content"
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="What did you discover today? Markdown is welcome."
                  />
                  <div>
                    <span className="muted">
                      {noteBody.trim().split(/\s+/).filter(Boolean).length}{" "}
                      words · Stored locally
                    </span>
                    {selectedNote && (
                      <button
                        className="icon-button"
                        aria-label="Delete note"
                        onClick={() =>
                          void run("Removing note…", async () => {
                            await api(`/notes/${selectedNote.id}`, {
                              method: "DELETE",
                            });
                            setSelectedNote(null);
                            setNoteBody("");
                            setNoteTitle("");
                            await refresh();
                          })
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                    <button
                      className="button primary"
                      disabled={!!busy || !noteTitle.trim()}
                      onClick={() =>
                        void run("Saving your thought…", async () => {
                          const n = await api<Note>(
                            selectedNote
                              ? `/notes/${selectedNote.id}`
                              : "/notes",
                            {
                              method: selectedNote ? "PUT" : "POST",
                              body: JSON.stringify({
                                title: noteTitle,
                                 content: noteBody,
                                 topic: noteTopic,
                              }),
                            },
                          );
                          setSelectedNote(n);
                          await refresh();
                          notify("A thought safely stowed.");
                        })
                      }
                    >
                      <Check size={16} /> Save note
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {page === "My progress" && (
            <>
              {sectionHeading(
                "LOOK HOW FAR YOU’VE SAILED",
                "Every small step counts.",
                "Your journey is measured in understanding, not speed.",
              )}
              <div className="stats-grid">
                <Stat
                  icon={<Flag />}
                  color="gold"
                  value={String(progress.xp)}
                  title="Total bounty"
                  detail="XP earned from learning"
                />
                <Stat
                  icon={<Flame />}
                  color="orange"
                  value={String(progress.streak)}
                  title="Day streak"
                  detail="One day at a time"
                />
                <Stat
                  icon={<CheckCircle2 />}
                  color="green"
                  value={String(progress.lessons_completed)}
                  title="Lessons completed"
                  detail="Ideas made your own"
                />
                <Stat
                  icon={<Swords />}
                  color="purple"
                  value={String(progress.cards_reviewed)}
                  title="Practice attempts"
                  detail="Flashcards and quiz answers"
                />
              </div>
              <div className="progress-panels">
                <section className="panel padded">
                  <h2>A week on the water</h2>
                  <p className="muted">Your learning activity · XP per day</p>
                  <div className="bar-chart">
                    {progress.weekly.map((d: any) => (
                      <div key={d.day}>
                        <span>{d.xp}</span>
                        <div className="bar-track">
                          <i
                            style={{
                              height: `${d.xp ? Math.max(5, (d.xp / Math.max(100, ...progress.weekly.map((x: any) => x.xp))) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <small>
                          {new Date(`${d.day}T12:00:00`).toLocaleDateString(
                            "en",
                            { weekday: "short" },
                          )}
                        </small>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel padded">
                  <h2>Your bearings by topic</h2>
                  <p className="muted">Accuracy across your practice answers</p>
                  {progress.topics
                    .filter((p: any) => p.cards_attempted > 0)
                    .map((p: any) => (
                      <div className="mastery-row" key={p.topic}>
                        <div>
                          <strong>{p.topic}</strong>
                          <span>{p.mastery_score}%</span>
                        </div>
                        <div className="progress-line">
                          <span style={{ width: `${p.mastery_score}%` }} />
                        </div>
                        {p.weak_concepts.length > 0 && (
                          <p>Revisit: {p.weak_concepts.join(", ")}</p>
                        )}
                      </div>
                    ))}
                  {!progress.topics.some((p: any) => p.cards_attempted > 0) && (
                    <Empty
                      icon={<Compass size={30} />}
                      title="A fresh page in your log."
                      text="Review a flashcard or take a quiz to chart your strengths."
                    />
                  )}
                </section>
              </div>
            </>
          )}

          {page === "Settings" && (
            <>
              {sectionHeading(
                "SHIP CONTROL",
                "Everything aboard, clearly arranged.",
                "Choose how Intellora thinks, sounds, stores, and travels with you.",
              )}
              <SettingsView
                models={models}
                setModels={setModels}
                sound={sound}
                setSound={setSound}
                busy={busy}
                online={online}
                onShare={() => setModal("share")}
                onSave={() =>
                  void run("Preparing your AI crew…", async () => {
                    await api("/settings/models", {
                      method: "PUT",
                      body: JSON.stringify({
                        provider: models.provider,
                        models: models.models,
                        api_keys: models.api_keys || {},
                        cloud_models: models.cloud_models || {},
                      }),
                    });
                    await refresh();
                    notify("Your AI route is saved.");
                  })
                }
              />
            </>
          )}
        </main>
      </div>

      {modal === "upload" && (
        <UploadModal
          close={closeModal}
          busy={busy}
          onSubmit={(kind, file, url, topic) =>
            void run("Bringing knowledge aboard…", async () => {
              if (kind === "file" && file) {
                const body = new FormData();
                body.append("file", file);
                body.append("topic", topic);
                await api("/resources/upload", { method: "POST", body });
              } else await post(`/resources/${kind}`, { url, topic });
              setModal(null);
              await refresh();
              notify(
                "Added to your library. Your first mate is reading it now.",
              );
            })
          }
        />
      )}
      {modal?.startsWith("generate") && (
        <GenerateModal
          kind={modal}
          topics={topics}
          busy={busy}
          close={closeModal}
          onSubmit={(topic, difficulty, count, focusTopics) =>
            void run("Starting your learning voyage…", async () => {
              const kind = modal;
              const path =
                kind === "generate-course"
                  ? "/courses/generate"
                  : kind === "generate-cards"
                    ? "/flashcards/generate"
                    : "/quizzes/generate";
              const result = await post(path, {
                topic,
                difficulty,
                count,
                focus_topics: focusTopics,
              });
              setModal(null);
              if (kind === "generate-course") {
                setCourseJob(result as CourseJob);
                setJobVisible(true);
              } else {
                await refresh();
                if (kind === "generate-cards") {
                  navigate("Flashcards");
                  setReviewed([]);
                  setRandomCard(null);
                } else {
                  navigate("Quizzes");
                  setActiveQuiz(result);
                  setAnswers({});
                }
                notify("Your next adventure is ready.");
              }
            })
          }
        />
      )}
      {courseJob && !jobVisible && (
        <button
          className={`job-dock ${courseJob.status}`}
          onClick={() => setJobVisible(true)}
        >
          <span>
            {courseJob.status === "failed" ? (
              <CircleHelp size={17} />
            ) : (
              <Loader2 className="spin" size={17} />
            )}
          </span>
          <div>
            <strong>
              {courseJob.status === "failed"
                ? "Course needs attention"
                : `Building ${courseJob.topic}`}
            </strong>
            <small>
              {courseJob.progress_total
                ? `${courseJob.progress_current} of ${courseJob.progress_total} lessons`
                : "Preparing the learning path"}
            </small>
          </div>
          <ChevronRight size={16} />
        </button>
      )}
      {courseJob && jobVisible && (
        <CourseGenerationProgress
          job={courseJob}
          close={() => setJobVisible(false)}
          retry={() =>
            void run("Restarting the voyage…", async () => {
              setCourseJob(
                await post<CourseJob>(`/courses/jobs/${courseJob.id}/retry`),
              );
              setJobVisible(true);
            })
          }
        />
      )}
      {modal === "search" && (
        <ModalFrame
          title="Search your ship."
          subtitle="Find words and ideas inside every published lesson and resource in your library. Select a result to jump directly to it."
          close={closeModal}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void searchShip();
            }}
          >
            <div className="search-field">
              <Search size={20} />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchRan(false);
                }}
                placeholder="Try “S3 permissions” or “overfitting”…"
                autoFocus
              />
              <button
                className="button primary"
                disabled={!!busy || !query.trim()}
              >
                Search
              </button>
            </div>
          </form>
          {!searchRan && (
            <div className="search-guide">
              <div>
                <strong>Search covers</strong>
                <span>
                  <BookOpen size={14} /> Course lessons
                </span>
                <span>
                  <FileText size={14} /> Uploaded and web resources
                </span>
              </div>
              <div>
                <strong>Try a starting point</strong>
                <button onClick={() => void searchShip("Machine Learning")}>
                  Machine Learning
                </button>
                <button onClick={() => void searchShip("AWS S3")}>
                  AWS S3
                </button>
                <button onClick={() => void searchShip("cross-validation")}>
                  Cross-validation
                </button>
              </div>
            </div>
          )}
          <div className="search-results">
            {searchResults.map((r) => (
              <button
                key={`${r.kind}-${r.id}`}
                onClick={() =>
                  void run(
                    `Opening ${r.kind === "lesson" ? "lesson" : r.kind === "note" ? "note" : "source"}…`,
                    async () => {
                      if (r.kind === "lesson") {
                        const course = await api<Course>(
                          `/courses/${r.course_id}`,
                        );
                        setModal(null);
                        openCourse(course);
                        setLessonIndex(
                          Math.max(
                            0,
                            course.lessons.findIndex(
                              (l) => l.id === r.lesson_id,
                            ),
                          ),
                        );
                      } else if (r.kind === "note") {
                        const note = notes.find(item => item.id === r.note_id);
                        if (note) { setSelectedNote(note); setNoteTitle(note.title); setNoteBody(note.content); setNoteTopic(note.topic || "General"); setPage("Captain’s notes"); }
                        setModal(null);
                      } else {
                        setSourcePreview(
                          await api(`/resources/${r.source_id}`),
                        );
                        setModal(null);
                      }
                    },
                  )
                }
              >
                <strong>
                  {r.kind === "lesson" ? (
                    <BookOpen size={15} />
                  ) : r.kind === "note" ? (
                    <NotebookPen size={15} />
                  ) : (
                    <FileText size={15} />
                  )}{" "}
                  {r.title}
                </strong>
                <p>{r.content.slice(0, 300)}…</p>
                <small>
                  {r.kind === "lesson"
                    ? `Course lesson · ${r.topic}`
                    : r.kind === "note" ? `Captain’s note · ${r.topic}` : `Source passage · ${r.topic}`}
                </small>
              </button>
            ))}
            {!searchResults.length && searchRan && (
              <div className="search-empty">
                <Search size={25} />
                <strong>No match for “{query}”</strong>
                <p>
                  Try a shorter concept name or open the AI first mate for a
                  broader explanation.
                </p>
              </div>
            )}
          </div>
        </ModalFrame>
      )}
      {modal === "share" && (
        <ModalFrame
          title="Invite a crewmate."
          subtitle="Invite people to their own isolated learning workspace—never to your notes, uploads, history, or keys."
          close={closeModal}
        >
          <div className="share-steps">
            <div>
              <span>1</span>
              <p>
                <strong>For LinkedIn: share the hosted link</strong>After deployment, copy the HTTPS address below. A visitor signs in with Google and receives a private, separate workspace.
              </p>
            </div>
            <div>
              <span>2</span>
              <p>
                <strong>AI remains local-first where possible</strong>A cloud server cannot use a visitor’s laptop Ollama. Hosted visitors can add their own Gemini, OpenRouter, Groq, or Sarvam key; otherwise your server key and daily limits apply.
              </p>
            </div>
            <div>
              <span>3</span>
              <p>
                <strong>For a fully local copy</strong>Run <code>.\prepare-share.ps1</code> and send the generated ZIP. It excludes <code>backend/.env</code>, <code>backend/data</code>, uploads, notes, and history.
              </p>
            </div>
            <div>
              <span>4</span>
              <p>
                <strong>What this feature is for</strong>Use the public link for audiences and the safe ZIP for technical friends who want private, offline-first learning on their own computer.
              </p>
            </div>
          </div>
          <div className="share-actions">
            <button
              className="button outline"
              onClick={() => {
                void navigator.clipboard.writeText(
                  location.origin,
                );
                notify("Share link copied.");
              }}
            >
              <Copy size={16} /> Copy share link
            </button>
            <button
              className="button primary"
              onClick={() => {
                setModal(null);
                navigate("Settings");
              }}
            >
              <Settings2 size={16} /> Open ship settings
            </button>
          </div>
          <p className="share-warning">
            <LockKeyhole size={15} />
            Never send your existing <code>backend/.env</code> or{" "}
            <code>backend/data</code> folder.
          </p>
        </ModalFrame>
      )}
      {modal === "reminders" && (
        <ModalFrame
          title="A gentle nudge from your crew."
          subtitle="Keep good ideas from drifting away."
          close={closeModal}
        >
          <div className="reminder-summary">
            <Layers3 size={36} />
            <strong>{progress.due_cards} cards ready to revisit</strong>
            <p>A few minutes of recall can make all the difference.</p>
            <button
              className="button primary"
              onClick={() => {
                setModal(null);
                navigate("Flashcards");
              }}
            >
              Head to the training deck <ArrowRight size={16} />
            </button>
          </div>
        </ModalFrame>
      )}
      {editingCard && (
        <EditCardModal
          card={editingCard}
          busy={busy}
          close={() => setEditingCard(null)}
          onSave={(changes) =>
            void run("Saving your learning card…", async () => {
              await api(`/flashcards/${editingCard.id}`, {
                method: "PUT",
                body: JSON.stringify(changes),
              });
              setEditingCard(null);
              setRandomCard(null);
              await refresh();
              notify(
                "Learning card updated. Its review schedule starts fresh.",
              );
            })
          }
        />
      )}
      {sourcePreview && (
        <ModalFrame
          title={sourcePreview.title}
          subtitle={`${sourcePreview.topic} · ${sourcePreview.chunks} searchable passages · ${sourcePreview.status}`}
          close={() => setSourcePreview(null)}
        >
          <div className="source-preview markdown">
            {sourcePreview.error ? (
              <p className="error-text">{sourcePreview.error}</p>
            ) : (
              <Markdown>
                {sourcePreview.content ||
                  "Your first mate is still reading this resource. Check back in a moment."}
              </Markdown>
            )}
          </div>
        </ModalFrame>
      )}
      {error && (modal || editingCard) && (
        <div className="toast error-toast" role="alert">
          <CircleHelp size={18} />
          <span>{error}</span>
          <button
            className="icon-button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy-indicator" role="status">
          <Loader2 className="spin" size={17} />
          {busy}
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  color,
  value,
  title,
  detail,
}: {
  icon: ReactNode;
  color: string;
  value: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
    </div>
  );
}
function ResourceRow({
  resource: r,
  onClick,
}: {
  resource: Resource;
  onClick: () => void;
}) {
  return (
    <button className="resource-row" onClick={onClick}>
      <span className={`file-icon ${r.file_type === "pdf" ? "rose" : "green"}`}>
        {r.file_type === "youtube" ? (
          <Youtube size={20} />
        ) : r.file_type === "website" ? (
          <Globe size={20} />
        ) : (
          <FileText size={20} />
        )}
      </span>
      <div>
        <strong>{r.title}</strong>
        <p>
          {r.topic} <span>·</span> {r.file_type.toUpperCase()} <span>·</span>{" "}
          {r.chunks} passages
        </p>
        {r.error && <small className="error-text">{r.error}</small>}
      </div>
      <span className={`resource-status ${r.status}`}>
        {r.status === "processing" ? (
          <Loader2 size={13} className="spin" />
        ) : r.status === "ready" ? (
          <CheckCircle2 size={13} />
        ) : (
          <CircleHelp size={13} />
        )}{" "}
        {r.status}
      </span>
      <ChevronRight size={16} />
    </button>
  );
}
function UploadModal({
  close,
  busy,
  onSubmit,
}: {
  close: () => void;
  busy: string;
  onSubmit: (
    kind: string,
    file: File | null,
    url: string,
    topic: string,
  ) => void;
}) {
  const [kind, setKind] = useState("file"),
    [file, setFile] = useState<File | null>(null),
    [url, setUrl] = useState(""),
    [topic, setTopic] = useState("General"),
    [drag, setDrag] = useState(false);
  return (
    <ModalFrame
      title="Bring your knowledge aboard."
      subtitle="Turn your resources into conversations, courses, and discoveries."
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(kind, file, url, topic);
        }}
      >
        <div className="tab-bar">
          {[
            ["file", "Upload file", UploadCloud],
            ["url", "Website", Globe],
            ["youtube", "YouTube", Youtube],
            ["research", "Research", Compass],
          ].map(([id, label, Icon]: any) => (
            <button
              type="button"
              key={id}
              className={kind === id ? "active" : ""}
              onClick={() => setKind(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
        {kind === "file" ? (
          <label
            className={`dropzone ${drag ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
            }}
          >
            <UploadCloud size={36} />
            <strong>{file ? file.name : "Drop a little knowledge here"}</strong>
            <span>
              {file
                ? `${(file.size / 1024).toFixed(0)} KB · Click to choose a different file`
                : "or click to choose a file"}
            </span>
            <small>
              PDF, TXT, MD, DOCX, CSV, JSON, images, code & notebooks · Up to 25
              MB
            </small>
            <input
              type="file"
              accept=".pdf,.txt,.md,.docx,.csv,.json,.png,.jpg,.jpeg,.webp,.py,.ipynb,.sql"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        ) : kind === "research" ? (
          <div className="info-note">
            <Compass size={20} />
            Enter a topic below. Your crew will find up to 3 public Wikipedia
            sources and add them to your library.
          </div>
        ) : (
          <label className="field-label">
            {kind === "youtube" ? "YouTube video URL" : "Public article URL"}
            <input
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                kind === "youtube"
                  ? "https://youtube.com/watch?v=…"
                  : "https://…"
              }
            />
            <small className="muted">
              {kind === "youtube"
                ? "We read publicly available captions, including timestamps."
                : "We read public content and respect the website’s robots policy."}
            </small>
          </label>
        )}
        <label className="field-label">
          Which learning island?
          <input
            required
            maxLength={150}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Machine Learning"
          />
        </label>
        <button
          className="button primary full-width"
          disabled={!!busy || (kind === "file" && !file)}
        >
          {busy ? <Loader2 size={17} className="spin" /> : <Plus size={17} />}{" "}
          Add to my knowledge
        </button>
      </form>
    </ModalFrame>
  );
}
function CourseGenerationProgress({
  job,
  close,
  retry,
}: {
  job: CourseJob;
  close: () => void;
  retry: () => void;
}) {
  const labels: Record<CourseJob["status"], string> = {
    queued: "Preparing the crew",
    researching: "Researching trusted material",
    building_hierarchy: "Charting the complete syllabus",
    writing_lessons: "Writing lessons and practice",
    auditing: "Auditing course coverage",
    done: "Course ready",
    failed: "The voyage needs attention",
  };
  const percent = job.progress_total
    ? Math.min(
        100,
        Math.round((job.progress_current / job.progress_total) * 100),
      )
    : 8;
  const counter =
    job.status === "failed"
      ? "Stopped"
      : job.status === "done"
        ? "Complete"
        : job.progress_total
          ? `${job.progress_current} / ${job.progress_total}`
          : "Starting";
  const description =
    job.status === "failed"
      ? `${labels[job.status]}. The job has stopped and no background generation is still running.`
      : `${labels[job.status]}. This deliberately takes longer because every lesson, flashcard pack, and quiz is generated and validated separately. You can close this view; the job continues in the background.`;
  return (
    <div className="modal-backdrop">
      <section
        className="modal course-job"
        role="dialog"
        aria-modal="true"
        aria-label={`Generating ${job.topic}`}
      >
        <button
          className="icon-button modal-close"
          onClick={close}
          aria-label="Hide course progress"
        >
          <X size={20} />
        </button>
        <div
          className={`job-compass ${job.status === "failed" ? "failed" : ""}`}
        >
          {job.status === "failed" ? (
            <CircleHelp size={28} />
          ) : job.status === "done" ? (
            <CheckCircle2 size={31} />
          ) : (
            <Compass className="slow-spin" size={31} />
          )}
        </div>
        <span className="eyebrow">AUTONOMOUS COURSE BUILDER</span>
        <h2>
          {job.status === "failed"
            ? "We hit rough water."
            : job.status === "done"
              ? `Your complete ${job.topic} course is ready.`
              : `Building your complete ${job.topic} course.`}
        </h2>
        <p className="muted">{description}</p>
        <div className="job-progress">
          <div>
            <span>{labels[job.status]}</span>
            <strong>{counter}</strong>
          </div>
          <div className="job-progress-track">
            <i
              style={{
                width: `${job.status === "failed" ? percent : Math.max(percent, 8)}%`,
              }}
            />
          </div>
        </div>
        <div className="job-log" aria-live="polite">
          {job.log.map((entry, index) => (
            <div key={index}>
              <span>
                {index < job.log.length - 1 || job.status === "done" ? (
                  <Check size={13} />
                ) : job.status === "failed" ? (
                  <CircleHelp size={13} />
                ) : (
                  <Loader2 className="spin" size={13} />
                )}
              </span>
              <p>{entry.message}</p>
            </div>
          ))}
        </div>
        {job.error && (
          <div className="job-error">
            <strong>What happened</strong>
            <p>{job.error}</p>
          </div>
        )}
        <div className="job-actions">
          <button className="button outline" onClick={close}>
            Continue exploring
          </button>
          {job.status === "failed" && (
            <button className="button primary" onClick={retry}>
              <Sparkles size={16} /> Retry the full course
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
function GenerateModal({
  kind,
  topics,
  busy,
  close,
  onSubmit,
}: {
  kind: string;
  topics: Topic[];
  busy: string;
  close: () => void;
  onSubmit: (
    topic: string,
    difficulty: string,
    count: number,
    focusTopics: string[],
  ) => void;
}) {
  const [topic, setTopic] = useState(""),
    [difficulty, setDifficulty] = useState("beginner"),
    [count, setCount] = useState(5),
    [focus, setFocus] = useState("");
  const isCards = kind === "generate-cards";
  return (
    <ModalFrame
      title={
        kind === "generate-course"
          ? "Chart a complete learning voyage."
          : isCards
            ? "Create focused learning cards."
            : "Ready for a new challenge?"
      }
      subtitle={
        kind === "generate-course"
          ? "Your crew will research, plan, write, validate, and audit the whole course in the background."
          : isCards
            ? "Each card becomes a mini reference: explanation, key points, example, and useful source links."
            : "Your AI crew will build this around your topic and available source material."
      }
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(
            topic,
            difficulty,
            count,
            focus
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean)
              .slice(0, 8),
          );
        }}
      >
        <label className="field-label">
          What would you like to learn?
          <input
            required
            maxLength={150}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. AWS, neural networks, SQL joins…"
            list="topic-options"
          />
          <datalist id="topic-options">
            {topics.map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        </label>
        <label className="field-label">
          Choose your starting point
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="beginner">Beginner · A fresh horizon</option>
            <option value="intermediate">
              Intermediate · Finding my sea legs
            </option>
            <option value="advanced">Advanced · Into deeper waters</option>
          </select>
        </label>
        {kind !== "generate-course" && (
          <label className="field-label">
            How many {isCards ? "learning cards" : "questions"}?
            <input
              type="number"
              min={1}
              max={12}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
        )}
        {isCards && (
          <label className="field-label">
            Specific topics to focus on{" "}
            <span className="muted">(optional)</span>
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. IAM, S3, VPC, Lambda"
            />
            <small className="muted">
              Separate topics with commas. Leave blank for broad coverage.
            </small>
          </label>
        )}
        <div className="info-note">
          <Sparkles size={17} />
          {kind === "generate-course"
            ? "Usually 8–20 substantial lessons, each with 5+ learning cards and 5+ quiz questions. Broad subjects take several minutes—and that is expected."
            : isCards
              ? "Not quiz prompts: these are detailed, reusable concept references with examples and links."
              : "Built for understanding, with explanations and spaced practice."}
        </div>
        <button className="button primary full-width" disabled={!!busy}>
          {busy ? (
            <Loader2 size={17} className="spin" />
          ) : (
            <Sparkles size={17} />
          )}{" "}
          {busy
            ? "Preparing the voyage…"
            : kind === "generate-course"
              ? "Build the complete course"
              : isCards
                ? "Create learning cards"
                : "Create challenge"}
        </button>
      </form>
    </ModalFrame>
  );
}

function EditCardModal({
  card,
  busy,
  close,
  onSave,
}: {
  card: Card;
  busy: string;
  close: () => void;
  onSave: (changes: {
    question: string;
    answer: string;
    explanation: string;
    worked_example: string;
    key_points: string[];
  }) => void;
}) {
  const [question, setQuestion] = useState(card.question),
    [answer, setAnswer] = useState(card.answer),
    [explanation, setExplanation] = useState(card.explanation || ""),
    [example, setExample] = useState(card.worked_example || ""),
    [points, setPoints] = useState((card.key_points || []).join("\n"));
  return (
    <ModalFrame
      title="Make this learning card your own."
      subtitle="Edit the concept reference. One key point per line works best."
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            question,
            answer,
            explanation,
            worked_example: example,
            key_points: points
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean),
          });
        }}
      >
        <label className="field-label">
          Concept title
          <input
            required
            minLength={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <label className="field-label">
          Quick overview
          <textarea
            required
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
          />
        </label>
        <label className="field-label">
          Detailed explanation
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={6}
          />
        </label>
        <label className="field-label">
          Key points
          <textarea
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            rows={4}
            placeholder="One key point per line"
          />
        </label>
        <label className="field-label">
          Concrete example
          <textarea
            value={example}
            onChange={(e) => setExample(e.target.value)}
            rows={4}
          />
        </label>
        <button className="button primary full-width" disabled={!!busy}>
          <Check size={16} /> Save learning card
        </button>
      </form>
    </ModalFrame>
  );
}

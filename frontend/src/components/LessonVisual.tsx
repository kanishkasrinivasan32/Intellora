import { useEffect, useMemo, useState } from 'react';
import { Eye, Pause, Play, RotateCcw } from 'lucide-react';
import { DiagramKind, LessonDiagram } from './LessonDiagram';

type Step = { label: string; description: string; role?: 'input' | 'process' | 'decision' | 'output' };
type Visual = { title: string; subtitle: string; steps: Step[] };

const flow = (title: string, subtitle: string, steps: Array<[string, string, Step['role']?]>): Visual => ({
  title,
  subtitle,
  steps: steps.map(([label, description, role = 'process']) => ({ label, description, role })),
});

function diagramKind(topic: string, title: string): DiagramKind {
  const key = `${topic} ${title}`.toLowerCase();
  if (/unsupervised|clustering|dimensionality/.test(key)) return 'cluster';
  if (/cross.validation|validation fold/.test(key)) return 'validation';
  if (/metric|evaluation|confusion|precision|recall/.test(key)) return 'matrix';
  if (/time series|forecast|recurrent|rnn/.test(key)) return 'timeline';
  if (/neural|deep learning|architecture search/.test(key)) return 'neural';
  if (/aws|s3|iam|vpc|subnet|route table|ec2|lambda|cloudformation|dynamodb|rds/.test(key)) return 'network';
  if (/machine learning|supervised|reinforcement|active learning|bayesian|failure|debug|model deployment|hyperparameter/.test(key)) return 'cycle';
  return 'flow';
}

function lessonVisual(topic: string, title: string, content: string): Visual {
  const key = `${topic} ${title}`.toLowerCase();
  if (/(s3|object storage)/.test(key)) return flow('How an S3 request becomes a durable object', 'Follow one upload from the application to retrieval.', [
    ['Client request', 'An app sends a signed PutObject request containing the bucket, object key, body, and metadata.', 'input'],
    ['Identity check', 'AWS authenticates the signature, then evaluates IAM, bucket, access-point, and organization policies.', 'decision'],
    ['S3 endpoint', 'The regional S3 API validates the request, object size, headers, encryption choice, and target bucket.', 'process'],
    ['Protect & distribute', 'S3 encrypts the object and redundantly stores it across multiple facilities inside the Region.', 'process'],
    ['Index by key', 'The object is addressed by bucket plus key; metadata and version information make later retrieval precise.', 'process'],
    ['Response or delivery', 'S3 confirms the write. Later GetObject requests can return it directly or through CloudFront.', 'output'],
  ]);
  if (/(iam|identity|permission|policy)/.test(key) && /aws/.test(key)) return flow('How AWS decides whether an action is allowed', 'Every request passes through the same policy decision path.', [
    ['Principal signs request', 'A user, role, workload, or AWS service presents temporary or long-lived credentials.', 'input'],
    ['Authenticate', 'AWS verifies the signature and resolves the principal, account, session, and request context.', 'process'],
    ['Collect policies', 'Identity, resource, permission-boundary, session, SCP, and endpoint policies are gathered.', 'process'],
    ['Explicit deny?', 'Any matching explicit Deny wins immediately, even when another policy allows the action.', 'decision'],
    ['Matching allow?', 'With no explicit deny, at least one applicable Allow must match the action, resource, and conditions.', 'decision'],
    ['Allow or deny', 'The service performs the operation only after authorization succeeds; otherwise it returns AccessDenied.', 'output'],
  ]);
  if (/(vpc|route table|network|subnet|security group|nacl)/.test(key) && /aws/.test(key)) return flow('How traffic moves through an AWS VPC', 'Trace one packet through routing and security boundaries.', [
    ['Source workload', 'An EC2 instance, load balancer, or client creates a packet for a destination IP and port.', 'input'],
    ['Route lookup', 'The subnet route table selects the most specific route: local, internet gateway, NAT, peering, or transit gateway.', 'decision'],
    ['Subnet boundary', 'A stateless network ACL checks both outbound and return-path rules in numeric order.', 'process'],
    ['Instance boundary', 'A stateful security group evaluates allowed flows; response traffic for an allowed flow is remembered.', 'process'],
    ['Target service', 'The destination receives the packet only if its own route and security rules also permit it.', 'output'],
  ]);
  if (/(ec2|virtual server|compute instance)/.test(key) && /aws/.test(key)) return flow('What happens when an EC2 instance launches', 'From an API request to a reachable virtual machine.', [
    ['Launch request', 'You choose an AMI, instance type, network, storage, IAM role, and user-data script.', 'input'],
    ['Capacity placement', 'EC2 places the virtual machine on suitable host capacity in the selected Availability Zone.', 'process'],
    ['Boot from AMI', 'The root volume is created and the operating system boots from the selected machine image.', 'process'],
    ['Attach identity & network', 'ENIs, private addressing, security groups, and instance-profile credentials become available.', 'process'],
    ['Run initialization', 'Cloud-init or user data installs software and starts the application.', 'process'],
    ['Serve & observe', 'Health checks, logs, metrics, scaling rules, and load balancers determine how the instance is used.', 'output'],
  ]);
  if (/(lambda|serverless)/.test(key) && /aws/.test(key)) return flow('How an AWS Lambda event is executed', 'See the lifecycle behind one serverless invocation.', [
    ['Event arrives', 'API Gateway, S3, a queue, a schedule, or another service produces an invocation event.', 'input'],
    ['Authorize & queue', 'The invoking service and Lambda permissions are checked; asynchronous events may be queued and retried.', 'decision'],
    ['Choose environment', 'Lambda reuses a warm execution environment or creates and initializes a new one.', 'process'],
    ['Run handler', 'Your handler receives the event and context, then calls downstream services using its execution role.', 'process'],
    ['Return or retry', 'The result goes to the caller, destination, retry policy, or dead-letter path depending on invocation type.', 'output'],
  ]);
  if (/(rds|dynamodb|database)/.test(key) && /aws/.test(key)) return flow('How an application reaches managed data on AWS', 'The path differs for relational and key-value workloads.', [
    ['Application query', 'The workload sends SQL to an RDS endpoint or an API operation to DynamoDB.', 'input'],
    ['Identity & network', 'Security groups, IAM, TLS, credentials, and endpoint policies establish whether the request can proceed.', 'decision'],
    ['Route to data', 'RDS directs the connection to a database instance; DynamoDB routes the key to the owning partition.', 'process'],
    ['Execute safely', 'The engine evaluates the query or key operation while concurrency and consistency controls protect data.', 'process'],
    ['Persist & replicate', 'Logs and replicas preserve changes for recovery and availability according to the service configuration.', 'process'],
    ['Return result', 'Rows, items, or an error return with latency and capacity metrics you can monitor.', 'output'],
  ]);
  if (/(cloudformation|infrastructure as code|iac)/.test(key)) return flow('How Infrastructure as Code becomes running AWS resources', 'A template is transformed into an ordered, repeatable deployment.', [
    ['Template', 'YAML or JSON declares resources, properties, parameters, outputs, and relationships.', 'input'],
    ['Validate & plan', 'CloudFormation parses the template, resolves references, and calculates required changes.', 'process'],
    ['Dependency graph', 'References and explicit dependencies determine a safe creation or update order.', 'process'],
    ['Provision resources', 'AWS service APIs create each resource while stack events expose progress and failures.', 'process'],
    ['Rollback boundary', 'If a required operation fails, rollback attempts to restore the last stable stack state.', 'decision'],
    ['Managed stack', 'Future template changes produce reviewed change sets instead of undocumented manual drift.', 'output'],
  ]);
  if (/unsupervised/.test(key)) return flow('How unsupervised learning discovers structure', 'There are no answer labels—the algorithm must organize the observations.', [
    ['Unlabelled data', 'Rows contain features but no target answer for the model to imitate.', 'input'],
    ['Represent & scale', 'Useful features are selected, encoded, and scaled so distance or similarity is meaningful.', 'process'],
    ['Optimize structure', 'A clustering, density, or dimensionality-reduction objective searches for a compact pattern.', 'process'],
    ['Inspect the pattern', 'You visualize clusters or components and check stability rather than relying on accuracy.', 'decision'],
    ['Attach meaning', 'Domain knowledge turns mathematical groups into segments, anomalies, or useful representations.', 'process'],
    ['Apply carefully', 'The structure supports exploration or downstream models, with monitoring for changing data.', 'output'],
  ]);
  if (/supervised/.test(key)) return flow('How supervised learning turns examples into predictions', 'Watch labels become feedback, then a reusable prediction rule.', [
    ['Labelled examples', 'Each training row contains input features and the known target the model should learn to predict.', 'input'],
    ['Split the evidence', 'Training data fits the model; validation guides choices; the test set stays untouched for final evaluation.', 'process'],
    ['Forward prediction', 'The current model transforms a feature vector into a score, value, or class probability.', 'process'],
    ['Measure loss', 'A loss function quantifies the difference between the prediction and the known target.', 'decision'],
    ['Update parameters', 'The learning algorithm changes parameters to reduce loss across many examples and repeats the cycle.', 'process'],
    ['Generalize', 'The frozen model receives new features and produces predictions that are monitored in the real world.', 'output'],
  ]);
  if (/(cross.validation|validation fold)/.test(key)) return flow('What k-fold cross-validation actually does', 'Every row gets a turn in validation while training remains separate.', [
    ['Shuffle or group', 'Prepare representative data while preserving time order or group boundaries when the problem requires it.', 'input'],
    ['Create k folds', 'Partition the development data into k non-overlapping subsets.', 'process'],
    ['Train on k−1', 'Fit preprocessing and the model only on the training folds for this round.', 'process'],
    ['Validate on one', 'Score the held-out fold using the metric that matches the real objective.', 'process'],
    ['Rotate & repeat', 'Each fold becomes validation exactly once, producing k independent scores.', 'process'],
    ['Aggregate', 'Use the mean and spread to compare choices; reserve a final test set for the last unbiased check.', 'output'],
  ]);
  if (/(preprocess|feature engineering)/.test(key)) return flow('How raw data becomes model-ready evidence', 'Every transformation must be learned without peeking at held-out answers.', [
    ['Raw observations', 'Tables, text, images, or events arrive with missing values, categories, noise, and inconsistent scales.', 'input'],
    ['Split first', 'Hold out validation and test data before learning imputation, encoding, or scaling parameters.', 'decision'],
    ['Clean & encode', 'Handle missingness, invalid values, categories, text, and dates using reproducible transformations.', 'process'],
    ['Scale & construct', 'Normalize numeric ranges and construct domain features that expose useful signal.', 'process'],
    ['Fit as a pipeline', 'Bundle preprocessing with the estimator so training and inference run the exact same steps.', 'process'],
    ['Monitor inputs', 'Validate schemas and watch drift because a model is only as reliable as the data entering it.', 'output'],
  ]);
  if (/(metric|evaluation|confusion|precision|recall)/.test(key)) return flow('How model evaluation becomes a decision', 'A metric is useful only when it represents the cost of being wrong.', [
    ['Held-out examples', 'Use data that did not influence the fitted parameters or preprocessing statistics.', 'input'],
    ['Generate predictions', 'Record probabilities or numeric predictions before choosing thresholds.', 'process'],
    ['Count outcomes', 'For classification, separate true positives, false positives, false negatives, and true negatives.', 'process'],
    ['Apply metric', 'Compute precision, recall, F1, ROC/PR, MAE, or another measure aligned with the task.', 'process'],
    ['Choose threshold', 'Translate business costs and capacity constraints into an operating point.', 'decision'],
    ['Check slices & drift', 'Confirm performance across important groups and over time before trusting one headline score.', 'output'],
  ]);
  if (/(failure|debug|overfit|underfit)/.test(key)) return flow('How to debug a machine-learning failure', 'Diagnose the system in order instead of tuning randomly.', [
    ['Define the symptom', 'Name the failing metric, user group, time range, and expected behavior.', 'input'],
    ['Check data first', 'Inspect labels, leakage, schema changes, missingness, duplicates, and train/serve skew.', 'decision'],
    ['Compare baselines', 'A simple heuristic reveals whether complexity is adding real signal.', 'process'],
    ['Inspect error slices', 'Group mistakes by feature, class, confidence, and time to locate the failure pattern.', 'process'],
    ['Change one cause', 'Repair data, features, objective, threshold, or model while keeping the experiment controlled.', 'process'],
    ['Revalidate & monitor', 'Repeat offline checks, staged release, and production monitoring before declaring success.', 'output'],
  ]);
  if (/(machine learning|regression|classification|model|neural|ensemble|hyperparameter|mlops)/.test(key)) return flow('The machine-learning system loop', 'A model is one stage inside a larger evidence-to-feedback system.', [
    ['Question & data', 'Turn a real decision into a measurable target, then collect representative observations.', 'input'],
    ['Prepare features', 'Split data, prevent leakage, and build repeatable transformations.', 'process'],
    ['Train candidate', 'Fit parameters by optimizing an objective on training examples.', 'process'],
    ['Validate choices', 'Compare against a baseline and inspect errors on held-out data.', 'decision'],
    ['Deploy inference', 'Package preprocessing and the model behind a batch job or service.', 'process'],
    ['Observe & improve', 'Monitor quality, drift, latency, and impact; feed new evidence into the next iteration.', 'output'],
  ]);

  const headings = [...content.matchAll(/^#{2,4}\s+(.+)$/gm)].map(match => match[1].replace(/[*_`]/g, '').trim());
  const paragraphs = content.split(/\n\s*\n/).map(part => part.replace(/^#+\s*/, '').trim()).filter(part => part.split(/\s+/).length > 12);
  const labels = [...new Set(headings)].slice(0, 6);
  while (labels.length < Math.min(5, Math.max(3, paragraphs.length))) labels.push(`Stage ${labels.length + 1}`);
  return flow(`How ${title} fits together`, 'A visual path derived from the major sections in this lesson.', labels.map((label, index) => [
    label,
    paragraphs[index]?.slice(0, 300) || `This stage connects the preceding idea to the next part of ${title}.`,
    index === 0 ? 'input' : index === labels.length - 1 ? 'output' : 'process',
  ]));
}

export function LessonVisual({ topic, title, content }: { topic: string; title: string; content: string }) {
  const visual = useMemo(() => lessonVisual(topic, title, content), [topic, title, content]);
  const kind = useMemo(() => diagramKind(topic, title), [topic, title]);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => { setActive(0); setPlaying(false); }, [visual.title]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setActive(current => {
      if (current >= visual.steps.length - 1) { setPlaying(false); return current; }
      return current + 1;
    }), 1800);
    return () => window.clearInterval(timer);
  }, [playing, visual.steps.length]);

  const step = visual.steps[active];
  const selectStep = (index:number, navigate = true) => {
    setActive(index); setPlaying(false);
    if (!navigate) return;
    window.setTimeout(()=>{
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('.lesson-body .markdown h2,.lesson-body .markdown h3,.lesson-body .markdown h4,.lesson-body .markdown p'));
      const terms = visual.steps[index].label.toLowerCase().split(/\W+/).filter(word=>word.length>3);
      const target = candidates.find(element=>terms.some(term=>element.textContent?.toLowerCase().includes(term))) || document.querySelector<HTMLElement>('.lesson-body .markdown');
      if (!target) return;
      target.classList.add('content-arrival'); target.scrollIntoView({behavior:'smooth',block:'center'});
      window.setTimeout(()=>target.classList.remove('content-arrival'),1800);
    },80);
  };
  return <section className="lesson-visual" aria-label={`Visualization for ${title}`}>
    <div className="lesson-visual-heading">
      <div><span className="eyebrow"><Eye size={14}/> SEE IT HAPPEN</span><h3>{visual.title}</h3><p>{visual.subtitle}</p></div>
      <div className="visual-controls">
        <button className="button outline compact" onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? 'Pause' : 'Play flow'}</button>
        <button className="icon-button" onClick={() => { setActive(0); setPlaying(false); }} aria-label="Reset visualization" title="Reset"><RotateCcw size={16}/></button>
      </div>
    </div>
    <LessonDiagram kind={kind} steps={visual.steps} active={active} onSelect={index => selectStep(index)}/>
    <div className="visual-explanation" aria-live="polite">
      <span>STEP {active + 1} OF {visual.steps.length}</span><div><h4>{step.label}</h4><p>{step.description}</p></div>
    </div>
    <p className="visual-note">Conceptual view · click a stage to inspect it. Exact service behavior can vary with configuration.</p>
  </section>;
}

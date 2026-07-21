import styles from './ServerByokNotice.module.css';

interface ServerByokNoticeProps {
  /** Operator's pinned model, when they set one. Display only. */
  model?: string;
  title: string;
  hint: string;
}

/**
 * Stands in for the API-key field when the daemon supplies the credential
 * itself (a hosted deployment). The user cannot obtain or change this key, so
 * the point is to explain the absence of the field rather than to offer a
 * disabled input they might try to fight with.
 */
export function ServerByokNotice({ model, title, hint }: ServerByokNoticeProps) {
  return (
    <div className={styles.notice}>
      <svg
        className={styles.icon}
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 1.5 3 3.5v4c0 3 2.1 5.6 5 7 2.9-1.4 5-4 5-7v-4L8 1.5Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path
          d="m6 7.8 1.5 1.5L10.2 6.4"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className={styles.body}>
        <span className={styles.title}>{title}</span>
        <span className={styles.hint}>{hint}</span>
        {model ? <span className={styles.model}>{model}</span> : null}
      </div>
    </div>
  );
}

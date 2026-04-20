import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="shell shell--explorer">
      <div className="empty-state empty-state--panel">
        <span className="empty-icon">⌁</span>
        <p>This workspace route does not exist.</p>
        <Link className="review-link-button" to="/explorer">
          Go to Explorer
        </Link>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '20px' }}>
        <div className="card" style={{ padding: '40px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏢</div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--gray-900)', marginBottom: '4px' }}>
              Office Booking
            </h1>
            <p style={{ color: 'var(--gray-500)', fontSize: '13px' }}>
              Sign in to manage rooms and conferences
            </p>
          </div>

          {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ marginTop: '8px', justifyContent: 'center', padding: '11px' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '24px', padding: '12px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--gray-500)' }}>
            <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--gray-600)' }}>Default accounts:</strong>
            admin@company.com / Admin123!<br />
            secretary@company.com / Secretary123!
          </div>
        </div>
      </div>
    </div>
  );
}

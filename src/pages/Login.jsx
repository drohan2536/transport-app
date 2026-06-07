import React, { useState, useRef, useEffect } from 'react';

async function safeJson(res) {
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
        throw new Error('Server unavailable. Please make sure the backend is running.');
    }
    return res.json();
}

export default function Login({ onLogin }) {
    const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'otp'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [signupSuccess, setSignupSuccess] = useState('');

    // Login fields
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginPass, setShowLoginPass] = useState(false);

    // Signup fields
    const [signupName, setSignupName] = useState('');
    const [signupUsername, setSignupUsername] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupPhone, setSignupPhone] = useState('');
    const [showSignupPass, setShowSignupPass] = useState(false);

    // OTP fields
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [devOtp, setDevOtp] = useState('');
    const [otpTimer, setOtpTimer] = useState(0);
    const otpRefs = useRef([]);

    useEffect(() => {
        if (otpTimer > 0) {
            const t = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
            return () => clearTimeout(t);
        }
    }, [otpTimer]);

    const handleOtpChange = (index, value) => {
        if (value.length > 1) value = value.slice(-1);
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            setOtp(pasted.split(''));
            otpRefs.current[5]?.focus();
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: loginUsername, password: loginPassword })
            });
            const data = await safeJson(res);
            if (!res.ok) throw new Error(data.error || 'Login failed');
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            onLogin(data.user, data.token);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: signupName,
                    username: signupUsername,
                    password: signupPassword,
                    phone: signupPhone
                })
            });
            const data = await safeJson(res);
            if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
            if (data.otp_dev) setDevOtp(data.otp_dev);
            setMode('otp');
            setOtpTimer(120);
            setOtp(['', '', '', '', '', '']);
            setTimeout(() => otpRefs.current[0]?.focus(), 200);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            setError('Please enter the complete 6-digit OTP');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: signupPhone, otp: otpString })
            });
            const data = await safeJson(res);
            if (!res.ok) throw new Error(data.error || 'Verification failed');
            // Signup complete — redirect to login page
            setMode('login');
            setSignupSuccess('Account created successfully! Please sign in.');
            setLoginUsername(signupUsername);
            setLoginPassword('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (otpTimer > 0) return;
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: signupName,
                    username: signupUsername,
                    password: signupPassword,
                    phone: signupPhone
                })
            });
            const data = await safeJson(res);
            if (!res.ok) throw new Error(data.error || 'Failed to resend OTP');
            if (data.otp_dev) setDevOtp(data.otp_dev);
            setOtpTimer(120);
            setOtp(['', '', '', '', '', '']);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            {/* Animated background elements */}
            <div className="login-bg-shapes">
                <div className="login-shape login-shape-1"></div>
                <div className="login-shape login-shape-2"></div>
                <div className="login-shape login-shape-3"></div>
            </div>

            <div className="login-container">
                {/* Brand */}
                <div className="login-brand">
                    <div className="login-brand-icon">🚛</div>
                    <h1>Transport Manager</h1>
                    <p>Manage your fleet, invoices & workforce</p>
                </div>

                {/* Card */}
                <div className="login-card">
                    {mode !== 'otp' && (
                        <div className="login-tabs">
                            <button
                                className={`login-tab ${mode === 'login' ? 'active' : ''}`}
                                onClick={() => { setMode('login'); setError(''); setSignupSuccess(''); }}
                                type="button"
                            >
                                Sign In
                            </button>
                            <button
                                className={`login-tab ${mode === 'signup' ? 'active' : ''}`}
                                onClick={() => { setMode('signup'); setError(''); setSignupSuccess(''); }}
                                type="button"
                            >
                                Sign Up
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="login-error">
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    {signupSuccess && (
                        <div className="login-success">
                            <span>✅</span> {signupSuccess}
                        </div>
                    )}

                    {/* LOGIN FORM */}
                    {mode === 'login' && (
                        <form onSubmit={handleLogin} className="login-form">
                            <div className="login-field">
                                <label>Username</label>
                                <div className="login-input-wrap">
                                    <span className="login-input-icon">👤</span>
                                    <input
                                        id="login-username"
                                        type="text"
                                        placeholder="Enter your username"
                                        value={loginUsername}
                                        onChange={e => setLoginUsername(e.target.value)}
                                        autoFocus
                                        required
                                    />
                                </div>
                            </div>
                            <div className="login-field">
                                <label>Password</label>
                                <div className="login-input-wrap">
                                    <span className="login-input-icon">🔒</span>
                                    <input
                                        id="login-password"
                                        type={showLoginPass ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        value={loginPassword}
                                        onChange={e => setLoginPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="login-eye"
                                        onClick={() => setShowLoginPass(!showLoginPass)}
                                    >
                                        {showLoginPass ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>
                            <button
                                id="login-submit"
                                type="submit"
                                className="login-btn"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="login-spinner"></span>
                                ) : (
                                    <>Sign In<span className="login-btn-arrow">→</span></>
                                )}
                            </button>
                        </form>
                    )}

                    {/* SIGNUP FORM */}
                    {mode === 'signup' && (
                        <form onSubmit={handleSendOtp} className="login-form">
                            <div className="login-field">
                                <label>Full Name</label>
                                <div className="login-input-wrap">
                                    <span className="login-input-icon">✏️</span>
                                    <input
                                        id="signup-name"
                                        type="text"
                                        placeholder="Enter your full name"
                                        value={signupName}
                                        onChange={e => setSignupName(e.target.value)}
                                        autoFocus
                                        required
                                    />
                                </div>
                            </div>
                            <div className="login-field">
                                <label>Username</label>
                                <div className="login-input-wrap">
                                    <span className="login-input-icon">👤</span>
                                    <input
                                        id="signup-username"
                                        type="text"
                                        placeholder="Choose a username"
                                        value={signupUsername}
                                        onChange={e => setSignupUsername(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="login-field">
                                <label>Password</label>
                                <div className="login-input-wrap">
                                    <span className="login-input-icon">🔒</span>
                                    <input
                                        id="signup-password"
                                        type={showSignupPass ? 'text' : 'password'}
                                        placeholder="Create a password"
                                        value={signupPassword}
                                        onChange={e => setSignupPassword(e.target.value)}
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        className="login-eye"
                                        onClick={() => setShowSignupPass(!showSignupPass)}
                                    >
                                        {showSignupPass ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>
                            <div className="login-field">
                                <label>Mobile Number</label>
                                <div className="login-input-wrap">
                                    <span className="login-input-icon">📱</span>
                                    <span className="login-phone-prefix">+91</span>
                                    <input
                                        id="signup-phone"
                                        type="tel"
                                        placeholder="10-digit mobile number"
                                        value={signupPhone}
                                        onChange={e => setSignupPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        required
                                        pattern="[0-9]{10}"
                                    />
                                </div>
                            </div>
                            <button
                                id="signup-submit"
                                type="submit"
                                className="login-btn"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="login-spinner"></span>
                                ) : (
                                    <>Send OTP<span className="login-btn-arrow">→</span></>
                                )}
                            </button>
                        </form>
                    )}

                    {/* OTP VERIFICATION */}
                    {mode === 'otp' && (
                        <form onSubmit={handleVerifyOtp} className="login-form otp-form">
                            <button
                                type="button"
                                className="login-back"
                                onClick={() => { setMode('signup'); setError(''); }}
                            >
                                ← Back
                            </button>
                            <div className="otp-header">
                                <div className="otp-header-icon">📱</div>
                                <h3>Verify Your Number</h3>
                                <p>Enter the 6-digit code sent to <strong>+91 {signupPhone}</strong></p>
                            </div>

                            {devOtp && (
                                <div className="otp-dev-hint">
                                    Dev Mode — OTP: <strong>{devOtp}</strong>
                                </div>
                            )}

                            <div className="otp-inputs" onPaste={handleOtpPaste}>
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => otpRefs.current[i] = el}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        className={`otp-digit ${digit ? 'filled' : ''}`}
                                        value={digit}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        id={`otp-digit-${i}`}
                                    />
                                ))}
                            </div>

                            <button
                                id="verify-otp-submit"
                                type="submit"
                                className="login-btn"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="login-spinner"></span>
                                ) : (
                                    <>Verify & Create Account</>
                                )}
                            </button>

                            <div className="otp-resend">
                                {otpTimer > 0 ? (
                                    <span className="otp-timer">Resend in {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, '0')}</span>
                                ) : (
                                    <button type="button" className="otp-resend-btn" onClick={handleResendOtp}>
                                        Resend OTP
                                    </button>
                                )}
                            </div>
                        </form>
                    )}
                </div>

                <p className="login-footer">
                    Secure & encrypted • Transport Manager v1.0
                </p>
            </div>
        </div>
    );
}

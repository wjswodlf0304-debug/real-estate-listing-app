'use client';

import React, { useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { ADMIN_PASSWORD } from '../config/auth';

export default function LoginPage() {
  const router = useRouter();
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (pwd === ADMIN_PASSWORD) {
      // 비밀번호 맞으면 로컬스토리지에 표시해 두기
      if (typeof window !== 'undefined') {
        localStorage.setItem('adminAuthed', 'yes');
      }
      router.push('/'); // 매물 관리 페이지로 이동
    } else {
      setError('비밀번호가 틀렸습니다.');
    }
  };

  const wrap: CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f3f4f6',
  };

  const card: CSSProperties = {
    width: 340,
    background: '#fff',
    padding: 24,
    borderRadius: 12,
    boxShadow: '0 10px 25px rgba(0,0,0,.08)',
  };

  const input: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 14,
  };

  const btn: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    marginTop: 12,
    borderRadius: 8,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  };

  const errorText: CSSProperties = {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 8,
  };

  return (
    <main style={wrap}>
      <form style={card} onSubmit={onSubmit}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>관리자 로그인</h1>
        <input
          type="password"
          placeholder="관리자 비밀번호"
          style={input}
          value={pwd}
          onChange={e => setPwd(e.target.value)}
        />
        {error && <div style={errorText}>{error}</div>}
        <button type="submit" style={btn}>
          로그인
        </button>
      </form>
    </main>
  );
}

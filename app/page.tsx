'use client';

import React, { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

// 탭 목록
const TYPES = [
  '원룸',
  '투룸',
  '쓰리룸',
  '아파트',
  '상가',
  '사무실',
  '건물매매',
  '단독매매',
  '빌라매매',
  '토지',
];
const CREATE_TYPES = TYPES;

export default function Home() {
  const router = useRouter();

  // ------- 로그인 여부 확인 (너가 쓰던 localStorage 방식 유지) --------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ok = localStorage.getItem('adminAuthed');
    if (ok !== 'yes') router.push('/login');
  }, [router]);
  // ----------------------------------------------------------------

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [type, setType] = useState<string>('원룸'); // 기본 탭
  const [q, setQ] = useState('');
  const [openAdd, setOpenAdd] = useState(false);

  // 인라인 수정용
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // 전체 검색 모드 여부
  const [isSearchMode, setIsSearchMode] = useState(false);

  /** 목록 불러오기 */
  const load = async () => {
    setLoading(true);

    let query = supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });

    const keyword = q.trim();

    if (keyword) {
      // 🔍 검색어가 있으면 전체에서 검색
      setIsSearchMode(true);
      query = query.or(
        `address.ilike.%${keyword}%,note.ilike.%${keyword}%,contact.ilike.%${keyword}%`
      );
    } else {
      // 검색어 없으면 현재 탭(type) 기준
      setIsSearchMode(false);
      if (type) query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      alert('데이터 불러오기 실패: ' + error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    // 탭 바꾸면 검색모드 해제 + 검색어 초기화 + 목록 로드
    setIsSearchMode(false);
    setQ('');
    setEditingId(null);
    setEditForm({});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  /** 상태 변경(진행중/계약완료) */
  const onChangeStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('listings')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error(error);
      alert('상태 변경 실패: ' + error.message);
      return;
    }
    setRows(prev =>
      prev.map(r => (r.id === id ? { ...r, status: newStatus } : r))
    );
  };

  /** 삭제 */
  const onDelete = async (id: string) => {
    if (!confirm('정말 이 매물을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('listings').delete().eq('id', id);
    if (error) {
      console.error(error);
      alert('삭제 실패: ' + error.message);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  /** 필터 초기화 */
  const resetFilters = () => {
    setType('원룸');
    setQ('');
    setIsSearchMode(false);
    setEditingId(null);
    setEditForm({});
    load();
  };

  /** 인라인 수정 시작 */
  const startEdit = (row: any) => {
    setEditingId(row.id);
    setEditForm({
      address: row.address ?? '',
      land_area_m2: row.land_area_m2 ?? '',
      gross_area_m2: row.gross_area_m2 ?? '',
      floor: row.floor ?? '',
      price_manwon: row.price_manwon != null ? String(row.price_manwon) : '',
      maintenance: row.maintenance ?? '',
      options: row.options ?? '',
      premium: row.premium ?? '',
      bldg_use: row.bldg_use ?? '',
      contact: row.contact ?? '',
      note: row.note ?? '',
      contract_date: row.contract_date ?? '',
      expiry_date: row.expiry_date ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  /** 인라인 수정 저장 */
  const saveEdit = async () => {
    if (!editingId) return;

    const payload = {
      address: editForm.address || null,
      land_area_m2:
        editForm.land_area_m2 === '' ? null : Number(editForm.land_area_m2),
      gross_area_m2:
        editForm.gross_area_m2 === '' ? null : Number(editForm.gross_area_m2),
      floor: editForm.floor || null,
      price_manwon: editForm.price_manwon || null,
      maintenance: editForm.maintenance || null,
      options: editForm.options || null,
      premium: editForm.premium || null,
      bldg_use: editForm.bldg_use || null,
      contact: editForm.contact || null,
      note: editForm.note || null,
      contract_date: editForm.contract_date || null,
      expiry_date: editForm.expiry_date || null,
    };

    const { error } = await supabase
      .from('listings')
      .update(payload)
      .eq('id', editingId);

    if (error) {
      console.error(error);
      alert('수정 실패: ' + error.message);
      return;
    }

    setRows(prev =>
      prev.map(r => (r.id === editingId ? { ...r, ...payload } : r))
    );
    setEditingId(null);
    setEditForm({});
  };

  // ===== 테이블 종류 플래그 =====
  const isLandSaleType =
    type === '건물매매' || type === '단독매매' || type === '토지';
  const isVillaSaleType = type === '빌라매매';
  const isShopOrOffice = type === '상가' || type === '사무실';
  const isAptType = type === '아파트';
  const isLandOnly = type === '토지';

  // 토지/건물 평당가 계산 (만원 기준)
  const calcPyeongPrice = (r: any) => {
    if (!r.land_area_m2 || !r.price_manwon) return '-';
    const price = parseFloat(String(r.price_manwon).replaceAll(',', ''));
    const land = Number(r.land_area_m2);
    if (!Number.isFinite(price) || !Number.isFinite(land) || land === 0) return '-';
    const pyeong = land / 3.3058;
    const per = Math.round(price / pyeong);
    return per.toLocaleString();
  };

  // ===== UI 스타일 =====
  const tabBar: CSSProperties = {
    display: 'flex',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  };
  const tabBtn = (active: boolean): CSSProperties => ({
    padding: '6px 10px',
    borderRadius: 8,
    border: active ? '1px solid #2563eb' : '1px solid #d1d5db',
    background: active ? '#dbeafe' : '#fff',
    color: active ? '#1d4ed8' : '#111827',
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  const searchWrap: CSSProperties = {
    display: 'flex',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  };
  const searchInput: CSSProperties = {
    flex: 1,
    minWidth: 220,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    outline: 'none',
  };
  const btn: CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    whiteSpace: 'nowrap', // ✅ “검색초기화” 같은 줄바꿈 방지
  };

  const primaryBtn: CSSProperties = {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #2563eb',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };

  const cellInput: CSSProperties = {
    width: '100%',
    padding: '3px 6px', // ✅ 타이트
    borderRadius: 6,
    border: '1px solid #d1d5db',
    fontSize: 12,
    outline: 'none',
  };

  return (
    <main className="page-main" style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>매물 관리</h1>
      </div>

      {/* 유형 탭 */}
      <div style={tabBar} className="tab-bar">
        {TYPES.map(t => (
          <button
            key={t}
            style={tabBtn(t === type)}
            onClick={() => {
              setType(t);
              setQ('');
              setIsSearchMode(false);
              setEditingId(null);
              setEditForm({});
            }}
          >
            {t === '건물매매'
              ? '건물 매매'
              : t === '단독매매'
              ? '단독 매매'
              : t === '빌라매매'
              ? '빌라 매매'
              : t === '토지'
              ? '토지 매매'
              : t}
          </button>
        ))}
      </div>

      {/* 검색 + 버튼들 */}
      <div style={searchWrap} className="search-row">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') load();
          }}
          placeholder="주소 / 비고 / 연락처 검색 (전체에서 검색)"
          style={searchInput}
        />
        <button style={btn} onClick={load}>검색</button>
        <button style={btn} onClick={resetFilters}>초기화</button>
        <button onClick={() => setOpenAdd(true)} style={primaryBtn}>+ 매물 추가</button>
      </div>

      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
        {loading ? '불러오는 중…' : isSearchMode ? `검색 결과 ${rows.length}건` : `총 ${rows.length}건`}
      </div>

      {/* 표 */}
      <div className="table-wrap" style={{ overflowX: 'auto', border: '1px solid #d1d5db', borderRadius: 10 }}>
        {isSearchMode ? (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                {['번호','유형','주소','가격(만원)','층수','건축물 용도','연락처','상태','작업'].map(h => (
                  <th key={h} style={thStyle()}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const isDone = r.status === '계약완료';
                const isEditing = editingId === r.id;
                const isRowApt = r.type === '아파트';

                return (
                  <tr key={r.id} style={{ background: isDone ? '#fef2f2' : '#fff' }}>
                    <td style={tdStyle(true)}>{idx + 1}</td>
                    <td style={tdStyle(true)}>{r.type}</td>

                    <td style={tdStyle()}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.address ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, address: e.target.value }))} />
                      ) : r.address}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.price_manwon ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, price_manwon: e.target.value }))} />
                      ) : (r.price_manwon ?? '-') as string}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.floor ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, floor: e.target.value }))} />
                      ) : r.floor ?? '-'}
                    </td>

                    <td style={tdStyle()}>
                      {isRowApt ? '-' : isEditing ? (
                        <input style={cellInput} value={editForm.bldg_use ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, bldg_use: e.target.value }))} />
                      ) : r.bldg_use ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.contact ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, contact: e.target.value }))} />
                      ) : r.contact ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      <select value={r.status || '진행중'} onChange={e => onChangeStatus(r.id, e.target.value)} style={statusSelectStyle(r.status)}>
                        <option value="진행중">진행중</option>
                        <option value="계약완료">계약완료</option>
                      </select>
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} style={miniBtnPrimary}>저장</button>
                          <button onClick={cancelEdit} style={miniBtn}>취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)} style={miniBtnBlue}>수정</button>
                          <button onClick={() => onDelete(r.id)} style={miniBtnRed}>삭제</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 14, textAlign: 'center', color: '#9ca3af' }}>데이터가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        ) : isLandSaleType ? (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                {[
                  '번호','주소','대지면적(㎡)', ...(isLandOnly ? [] : ['연면적(㎡)']),
                  '매매가(만원)','평당가(만원)','연락처','비고','계약일','상태','작업'
                ].map(h => <th key={h} style={thStyle()}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const isDone = r.status === '계약완료';
                const isEditing = editingId === r.id;

                return (
                  <tr key={r.id} style={{ background: isDone ? '#fef2f2' : '#fff' }}>
                    <td style={tdStyle(true)}>{idx + 1}</td>

                    <td style={tdStyle()}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.address ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, address: e.target.value }))} />
                      ) : r.address}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.land_area_m2 ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, land_area_m2: e.target.value }))} />
                      ) : r.land_area_m2 ?? '-'}
                    </td>

                    {!isLandOnly && (
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input style={cellInput} value={editForm.gross_area_m2 ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, gross_area_m2: e.target.value }))} />
                        ) : r.gross_area_m2 ?? '-'}
                      </td>
                    )}

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.price_manwon ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, price_manwon: e.target.value }))} />
                      ) : (r.price_manwon ?? '-') as string}
                    </td>

                    <td style={tdStyle(true)}>{calcPyeongPrice(r)}</td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.contact ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, contact: e.target.value }))} />
                      ) : r.contact ?? '-'}
                    </td>

                    <td style={tdStyle()}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.note ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, note: e.target.value }))} />
                      ) : r.note ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input type="date" style={cellInput} value={editForm.contract_date ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, contract_date: e.target.value }))} />
                      ) : r.contract_date ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      <select value={r.status || '진행중'} onChange={e => onChangeStatus(r.id, e.target.value)} style={statusSelectStyle(r.status)}>
                        <option value="진행중">진행중</option>
                        <option value="계약완료">계약완료</option>
                      </select>
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} style={miniBtnPrimary}>저장</button>
                          <button onClick={cancelEdit} style={miniBtn}>취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)} style={miniBtnBlue}>수정</button>
                          <button onClick={() => onDelete(r.id)} style={miniBtnRed}>삭제</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={isLandOnly ? 10 : 11} style={{ padding: 14, textAlign: 'center', color: '#9ca3af' }}>
                    데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : isVillaSaleType ? (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                {[
                  '번호','주소','전용면적(㎡)','대지지분(㎡)','층수','매매가(만원)','관리비','옵션','연락처','비고','계약일','상태','작업'
                ].map(h => <th key={h} style={thStyle()}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const isDone = r.status === '계약완료';
                const isEditing = editingId === r.id;

                return (
                  <tr key={r.id} style={{ background: isDone ? '#fef2f2' : '#fff' }}>
                    <td style={tdStyle(true)}>{idx + 1}</td>

                    <td style={tdStyle()}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.address ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, address: e.target.value }))} />
                      ) : r.address}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.gross_area_m2 ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, gross_area_m2: e.target.value }))} />
                      ) : r.gross_area_m2 ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.land_area_m2 ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, land_area_m2: e.target.value }))} />
                      ) : r.land_area_m2 ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.floor ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, floor: e.target.value }))} />
                      ) : r.floor ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.price_manwon ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, price_manwon: e.target.value }))} />
                      ) : (r.price_manwon ?? '-') as string}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.maintenance ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, maintenance: e.target.value }))} />
                      ) : r.maintenance ?? '-'}
                    </td>

                    <td style={tdStyle()}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.options ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, options: e.target.value }))} />
                      ) : r.options ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.contact ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, contact: e.target.value }))} />
                      ) : r.contact ?? '-'}
                    </td>

                    <td style={tdStyle()}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.note ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, note: e.target.value }))} />
                      ) : r.note ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input type="date" style={cellInput} value={editForm.contract_date ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, contract_date: e.target.value }))} />
                      ) : r.contract_date ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      <select value={r.status || '진행중'} onChange={e => onChangeStatus(r.id, e.target.value)} style={statusSelectStyle(r.status)}>
                        <option value="진행중">진행중</option>
                        <option value="계약완료">계약완료</option>
                      </select>
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} style={miniBtnPrimary}>저장</button>
                          <button onClick={cancelEdit} style={miniBtn}>취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)} style={miniBtnBlue}>수정</button>
                          <button onClick={() => onDelete(r.id)} style={miniBtnRed}>삭제</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={13} style={{ padding: 14, textAlign: 'center', color: '#9ca3af' }}>데이터가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={thStyle()}>번호</th>
                <th style={thStyle()}>주소</th>
                <th style={thStyle()}>전용면적(㎡)</th>
                <th style={thStyle()}>층수</th>
                <th style={thStyle()}>가격(만원)</th>
                <th style={thStyle()}>관리비</th>
                <th style={thStyle()}>{isShopOrOffice ? '권리금(만원)' : '옵션'}</th>
                {!isAptType && <th style={thStyle()}>건축물 용도</th>}
                <th style={thStyle()}>연락처</th>
                <th style={thStyle()}>비고</th>
                <th style={thStyle()}>계약일</th>
                <th style={thStyle()}>만료일</th>
                <th style={thStyle()}>상태</th>
                <th style={thStyle()}>작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const isDone = r.status === '계약완료';
                const isEditing = editingId === r.id;
                const rowIsBiz = r.type === '상가' || r.type === '사무실';

                return (
                  <tr key={r.id} style={{ background: isDone ? '#fef2f2' : '#fff' }}>
                    <td style={tdStyle(true)}>{idx + 1}</td>

                    <td style={tdStyle()}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.address ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, address: e.target.value }))} />
                      ) : r.address}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.gross_area_m2 ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, gross_area_m2: e.target.value }))} />
                      ) : r.gross_area_m2 ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.floor ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, floor: e.target.value }))} />
                      ) : r.floor ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.price_manwon ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, price_manwon: e.target.value }))} />
                      ) : (r.price_manwon ?? '-') as string}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.maintenance ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, maintenance: e.target.value }))} />
                      ) : r.maintenance ?? '-'}
                    </td>

                    <td style={tdStyle()}>
                      {isEditing ? (
                        <input
                          style={cellInput}
                          value={rowIsBiz ? editForm.premium ?? '' : editForm.options ?? ''}
                          onChange={e =>
                            setEditForm((f: any) => ({
                              ...f,
                              ...(rowIsBiz ? { premium: e.target.value } : { options: e.target.value }),
                            }))
                          }
                        />
                      ) : rowIsBiz ? (
                        r.premium ?? '-'
                      ) : (
                        r.options ?? '-'
                      )}
                    </td>

                    {!isAptType && (
                      <td style={tdStyle()}>
                        {isEditing ? (
                          <input style={cellInput} value={editForm.bldg_use ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, bldg_use: e.target.value }))} />
                        ) : r.bldg_use ?? '-'}
                      </td>
                    )}

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.contact ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, contact: e.target.value }))} />
                      ) : r.contact ?? '-'}
                    </td>

                    <td style={tdStyle()}>
                      {isEditing ? (
                        <input style={cellInput} value={editForm.note ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, note: e.target.value }))} />
                      ) : r.note ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input type="date" style={cellInput} value={editForm.contract_date ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, contract_date: e.target.value }))} />
                      ) : r.contract_date ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <input type="date" style={cellInput} value={editForm.expiry_date ?? ''} onChange={e => setEditForm((f:any)=>({ ...f, expiry_date: e.target.value }))} />
                      ) : r.expiry_date ?? '-'}
                    </td>

                    <td style={tdStyle(true)}>
                      <select value={r.status || '진행중'} onChange={e => onChangeStatus(r.id, e.target.value)} style={statusSelectStyle(r.status)}>
                        <option value="진행중">진행중</option>
                        <option value="계약완료">계약완료</option>
                      </select>
                    </td>

                    <td style={tdStyle(true)}>
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} style={miniBtnPrimary}>저장</button>
                          <button onClick={cancelEdit} style={miniBtn}>취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)} style={miniBtnBlue}>수정</button>
                          <button onClick={() => onDelete(r.id)} style={miniBtnRed}>삭제</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={isAptType ? 13 : 14} style={{ padding: 14, textAlign: 'center', color: '#9ca3af' }}>
                    데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 매물 추가 모달 */}
      {openAdd && (
        <AddDialog
          currentType={type}
          onClose={() => setOpenAdd(false)}
          onSaved={() => {
            setOpenAdd(false);
            load();
          }}
        />
      )}

      {/* ✅ 모바일/반응형 */}
      <style jsx>{`
        .page-main { box-sizing: border-box; }

        @media (max-width: 768px) {
          .page-main { padding: 12px 10px !important; }

          .search-row {
            flex-direction: column;
            align-items: stretch !important;
          }
          .search-row input { width: 100%; min-width: 0 !important; }
          .search-row button { width: 100%; }

          .data-table { font-size: 12px !important; min-width: 860px; }
        }
      `}</style>
    </main>
  );
}

/** 헤더 셀 */
function thStyle(): CSSProperties {
  return {
    borderBottom: '1px solid #e5e7eb',
    borderRight: '1px solid #e5e7eb',
    padding: '8px 8px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    position: 'sticky' as any,
    top: 0,
    background: '#f9fafb',
    zIndex: 1,
    fontWeight: 700,
  };
}

/** 바디 셀 */
function tdStyle(center = false): CSSProperties {
  return {
    padding: '6px 8px', // ✅ 행 높이 낮춤
    borderBottom: '1px solid #eef2f7',
    borderRight: '1px solid #eef2f7',
    textAlign: center ? 'center' : 'left',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  };
}

const miniBtn: CSSProperties = {
  padding: '4px 8px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  fontSize: 12,
  cursor: 'pointer',
  marginLeft: 4,
  whiteSpace: 'nowrap',
};

const miniBtnPrimary: CSSProperties = {
  ...miniBtn,
  borderColor: '#111827',
  background: '#111827',
  color: '#fff',
};

const miniBtnBlue: CSSProperties = {
  ...miniBtn,
  borderColor: '#60a5fa',
  background: '#dbeafe',
  color: '#1d4ed8',
};

const miniBtnRed: CSSProperties = {
  ...miniBtn,
  borderColor: '#fca5a5',
  background: '#fef2f2',
  color: '#b91c1c',
};

function statusSelectStyle(status?: string): CSSProperties {
  const done = status === '계약완료';
  return {
    padding: '4px 8px',
    borderRadius: 8,
    border: done ? '1px solid #fca5a5' : '1px solid #d1d5db',
    color: done ? '#b91c1c' : '#111827',
    background: '#fff',
    fontSize: 12,
    outline: 'none',
  };
}

/** 매물 추가 다이얼로그 (✅ 모바일 완벽 대응 버전) */
function AddDialog({
  onClose,
  onSaved,
  currentType,
}: {
  onClose: () => void;
  onSaved: () => void;
  currentType: string;
}) {
  const [form, setForm] = useState({
    type: currentType || '',
    address: '',
    price_manwon: '',
    land_area_m2: '',
    gross_area_m2: '',
    floor: '',
    maintenance: '',
    options: '',
    premium: '',
    bldg_use: '',
    contact: '',
    note: '',
    contract_date: '',
    expiry_date: '',
  });
  const [saving, setSaving] = useState(false);

  const isLandSaleType =
    form.type === '건물매매' || form.type === '단독매매' || form.type === '토지';
  const isVillaSaleType = form.type === '빌라매매';
  const isBizLease = form.type === '상가' || form.type === '사무실';
  const isLandOnly = form.type === '토지';
  const isAptType = form.type === '아파트';

  const hideBldgUse = isLandSaleType || isAptType;

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.type) return alert('유형은 필수입니다.');
    if (!form.address.trim()) return alert('주소는 필수입니다.');

    setSaving(true);

    const payload = {
      type: form.type,
      address: form.address,
      price_manwon: form.price_manwon || null,
      land_area_m2: num(form.land_area_m2),
      gross_area_m2: num(form.gross_area_m2),
      floor: isLandOnly ? null : form.floor || null,
      maintenance: isLandSaleType ? null : form.maintenance || null,
      options: isLandSaleType ? null : form.options || null,
      premium: isBizLease ? form.premium || null : null,
      bldg_use: hideBldgUse ? null : form.bldg_use || null,
      contact: form.contact || null,
      note: form.note || null,
      contract_date: form.contract_date || null,
      expiry_date: form.expiry_date || null,
      status: '진행중',
    };

    const { error } = await supabase.from('listings').insert([payload]);
    setSaving(false);

    if (error) {
      console.error(error);
      alert('저장 실패: ' + error.message);
      return;
    }
    onSaved();
  };

  // ✅ 모바일에서도 절대 안 잘리게 (중요)
  const wrap: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: 12,
  };

  const card: CSSProperties = {
    width: 720,
    maxWidth: '100%',
    background: '#fff',
    borderRadius: 14,
    boxShadow: '0 12px 40px rgba(0,0,0,.18)',
    maxHeight: '88vh',         // ✅ 화면 밖으로 안 나감
    overflow: 'hidden',        // ✅ 내부 스크롤은 body에서
    display: 'flex',
    flexDirection: 'column',
  };

  const head: CSSProperties = {
    padding: 14,
    borderBottom: '1px solid #eef2f7',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  };

  const body: CSSProperties = {
    padding: 14,
    overflow: 'auto',          // ✅ 여기서 스크롤
    WebkitOverflowScrolling: 'touch',
  };

  const foot: CSSProperties = {
    padding: 12,
    borderTop: '1px solid #eef2f7',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    position: 'sticky',        // ✅ 하단 고정 느낌
    bottom: 0,
    background: '#fff',
  };

  const grid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: 8,
    alignItems: 'center',
  };

  const ip: CSSProperties = {
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    width: '100%',
    outline: 'none',
    fontSize: 13,
  };

  const footBtn: CSSProperties = {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    whiteSpace: 'nowrap',
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={head}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>매물 추가</h2>
          <button onClick={onClose} style={{ ...footBtn, padding: '6px 10px' }}>
            닫기
          </button>
        </div>

        <div style={body}>
          <div style={grid} className="add-grid">
            <label>유형</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} style={ip}>
              <option value="">선택</option>
              {CREATE_TYPES.map(t => (
                <option key={t} value={t}>
                  {t === '건물매매'
                    ? '건물 매매'
                    : t === '단독매매'
                    ? '단독 매매'
                    : t === '빌라매매'
                    ? '빌라 매매'
                    : t === '토지'
                    ? '토지 매매'
                    : t}
                </option>
              ))}
            </select>

            <label>주소</label>
            <input value={form.address} onChange={e => set('address', e.target.value)} style={ip} placeholder="예: 서울 광진구 자양동 123-4" />

            <label>{isLandSaleType || isVillaSaleType ? '매매가(만원)' : '가격(만원)'}</label>
            <input value={form.price_manwon} onChange={e => set('price_manwon', e.target.value)} style={ip} placeholder={isLandSaleType || isVillaSaleType ? '예: 30000' : '예: 5000/120'} />

            {/* 면적 */}
            {isLandSaleType ? (
              <>
                <label>대지면적(㎡)</label>
                <input value={form.land_area_m2} onChange={e => set('land_area_m2', e.target.value)} style={ip} inputMode="numeric" />
                {!isLandOnly && (
                  <>
                    <label>연면적(㎡)</label>
                    <input value={form.gross_area_m2} onChange={e => set('gross_area_m2', e.target.value)} style={ip} inputMode="numeric" />
                  </>
                )}
              </>
            ) : isVillaSaleType ? (
              <>
                <label>전용면적(㎡)</label>
                <input value={form.gross_area_m2} onChange={e => set('gross_area_m2', e.target.value)} style={ip} inputMode="numeric" />
                <label>대지지분(㎡)</label>
                <input value={form.land_area_m2} onChange={e => set('land_area_m2', e.target.value)} style={ip} inputMode="numeric" />
              </>
            ) : (
              <>
                <label>전용면적(㎡)</label>
                <input value={form.gross_area_m2} onChange={e => set('gross_area_m2', e.target.value)} style={ip} inputMode="numeric" />
              </>
            )}

            {/* 층수 */}
            {!isLandOnly && (
              <>
                <label>층수</label>
                <input value={form.floor} onChange={e => set('floor', e.target.value)} style={ip} placeholder="예: 3층 / 반지하 등" />
              </>
            )}

            {/* 관리비 */}
            {!isLandSaleType && (
              <>
                <label>관리비</label>
                <input value={form.maintenance} onChange={e => set('maintenance', e.target.value)} style={ip} placeholder="예: 5만원 / 없음" />
              </>
            )}

            {/* 옵션/권리금 */}
            {isLandSaleType ? null : isBizLease ? (
              <>
                <label>권리금(만원)</label>
                <input value={form.premium} onChange={e => set('premium', e.target.value)} style={ip} placeholder="예: 3000 / 없음" />
              </>
            ) : (
              <>
                <label>옵션</label>
                <input value={form.options} onChange={e => set('options', e.target.value)} style={ip} placeholder="예: 풀옵션, 세탁기, TV" />
              </>
            )}

            {/* 건축물 용도 */}
            {!hideBldgUse && (
              <>
                <label>건축물 용도</label>
                <input value={form.bldg_use} onChange={e => set('bldg_use', e.target.value)} style={ip} placeholder="예: 다세대주택, 근린생활시설" />
              </>
            )}

            <label>연락처</label>
            <input value={form.contact} onChange={e => set('contact', e.target.value)} style={ip} placeholder="010-0000-0000" />

            <label>계약일</label>
            <input type="date" value={form.contract_date} onChange={e => set('contract_date', e.target.value)} style={ip} />

            <label>만료일</label>
            <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} style={ip} />

            <label>비고</label>
            <input value={form.note} onChange={e => set('note', e.target.value)} style={ip} placeholder="옵션/특이사항 등" />
          </div>
        </div>

        <div style={foot}>
          <button onClick={onClose} style={footBtn}>취소</button>
          <button onClick={save} disabled={saving} style={{ ...footBtn, borderColor: '#2563eb', background: '#2563eb', color: '#fff', fontWeight: 700 }}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>

        {/* ✅ AddDialog 모바일 1열 폼 */}
        <style jsx>{`
          @media (max-width: 768px) {
            .add-grid {
              grid-template-columns: 1fr !important;
              gap: 8px !important;
            }
            .add-grid label {
              font-size: 12px;
              color: #6b7280;
              margin-top: 6px;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

function num(v: any) {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replaceAll(',', ''));
  return Number.isFinite(n) ? n : null;
}

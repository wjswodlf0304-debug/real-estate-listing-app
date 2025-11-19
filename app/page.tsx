'use client';

import React, { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

// 탭 목록 (아파트 추가)
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

const CREATE_TYPES = TYPES; // 매물추가용

export default function Home() {
  const router = useRouter();

  // ------- 로그인 여부 확인 --------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ok = localStorage.getItem('adminAuthed');
    if (ok !== 'yes') {
      router.push('/login');
    }
  }, [router]);
  // ---------------------------------

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
      if (type) {
        query = query.eq('type', type);
      }
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
    // 탭 바꾸면 검색모드 해제 + 목록 로드
    setIsSearchMode(false);
    setQ('');
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

  // 토지/건물 평당가 계산 (만원 기준)
  const calcPyeongPrice = (r: any) => {
    if (!r.land_area_m2 || !r.price_manwon) return '-';

    const price = parseFloat(String(r.price_manwon).replaceAll(',', ''));
    const land = Number(r.land_area_m2);

    if (!Number.isFinite(price) || !Number.isFinite(land) || land === 0) {
      return '-';
    }

    const pyeong = land / 3.3058;
    const per = Math.round(price / pyeong);
    return per.toLocaleString();
  };

  // 공통 스타일들
  const tabBar: CSSProperties = {
    display: 'flex',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  };
  const tabBtn = (active: boolean): CSSProperties => ({
    padding: '6px 10px',
    borderRadius: 6,
    border: active ? '1px solid #2563eb' : '1px solid #cdcfd3ff',
    background: active ? '#dbeafe' : '#f9fafb',
    color: active ? '#1d4ed8' : '#111827',
    fontSize: 13,
    cursor: 'pointer',
  });
  const searchWrap: CSSProperties = {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  };
  const searchInput: CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #9b9ea3ff',
  };
  const btn: CSSProperties = {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #9b9ea3ff',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
  };

  const cellInput: CSSProperties = {
    width: '100%',
    padding: '3px 4px',
    borderRadius: 4,
    border: '1px solid #d1d5db',
    fontSize: 12,
  };

  return (
    <>
      <main style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>매물 관리</h1>

        {/* 유형 탭 */}
        <div style={tabBar}>
          {TYPES.map(t => (
            <button
              key={t}
              style={tabBtn(t === type)}
              onClick={() => {
                setType(t);
                setQ('');
                setIsSearchMode(false);
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

        {/* 검색 + 매물추가 */}
        <div style={searchWrap}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') load();
            }}
            placeholder="주소 / 비고 / 연락처 검색 (전체에서 검색)"
            style={searchInput}
          />
          <button style={btn} onClick={load}>
            검색
          </button>
          <button style={btn} onClick={resetFilters}>
            초기화
          </button>
          <button
            onClick={() => setOpenAdd(true)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #2563eb',
              background: '#fff',
              color: '#2563eb',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            + 매물 추가
          </button>
        </div>

        <div style={{ fontSize: 13, color: '#585a5eff', marginBottom: 6 }}>
          {loading
            ? '불러오는 중…'
            : isSearchMode
            ? `검색 결과 ${rows.length}건`
            : `총 ${rows.length}건`}
        </div>

        {/* 엑셀 스타일 표 */}
        <div
          className="table-container"
          style={{
            overflowX: 'auto',
            border: '1px solid #4b5563',
          }}
        >
          {isSearchMode ? (
            /* ================= 전체 검색용 간단 테이블 ================= */
            <table
              className="list-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <thead style={{ background: '#f3f4f6' }}>
                <tr>
                  {[
                    '번호',
                    '유형',
                    '주소',
                    '가격(만원)',
                    '층수',
                    '건축물 용도',
                    '연락처',
                    '상태',
                    '작업',
                  ].map(h => (
                    <th
                      key={h}
                      className={
                        h === '건축물 용도' ? 'col-bldg-use' : undefined
                      }
                      style={{
                        border: '1px solid #9b9ea3',
                        padding: '6px 8px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const isDone = r.status === '계약완료';
                  const isEditing = editingId === r.id;
                  const isRowApt = r.type === '아파트';

                  return (
                    <tr
                      key={r.id}
                      style={{
                        background: isDone ? '#fef2f2' : '#ffffff',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      {/* 번호 */}
                      <td style={tdStyle(true)}>{idx + 1}</td>

                      {/* 유형 */}
                      <td style={tdStyle(true)}>{r.type}</td>

                      {/* 주소 */}
                      <td style={tdStyle()}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.address ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                address: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.address
                        )}
                      </td>

                      {/* 가격 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.price_manwon ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                price_manwon: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          (r.price_manwon ?? '-') as string
                        )}
                      </td>

                      {/* 층수 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.floor ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                floor: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.floor ?? '-'
                        )}
                      </td>

                      {/* 건축물 용도 – 아파트는 안 씀 */}
                      <td style={tdStyle()} className="col-bldg-use">
                        {isRowApt
                          ? '-'
                          : isEditing
                          ? (
                              <input
                                style={cellInput}
                                value={editForm.bldg_use ?? ''}
                                onChange={e =>
                                  setEditForm((f: any) => ({
                                    ...f,
                                    bldg_use: e.target.value,
                                  }))
                                }
                              />
                            )
                          : r.bldg_use ?? '-'}
                      </td>

                      {/* 연락처 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.contact ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                contact: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.contact ?? '-'
                        )}
                      </td>

                      {/* 상태 */}
                      <td style={tdStyle(true)}>
                        <select
                          value={r.status || '진행중'}
                          onChange={e =>
                            onChangeStatus(r.id, e.target.value as string)
                          }
                          style={{
                            padding: '3px 6px',
                            borderRadius: 4,
                            border:
                              r.status === '계약완료'
                                ? '1px solid #fca5a5'
                                : '1px solid #d1d5db',
                            color:
                              r.status === '계약완료' ? '#b91c1c' : '#111827',
                            background: '#ffffff',
                            fontSize: 12,
                          }}
                        >
                          <option value="진행중">진행중</option>
                          <option value="계약완료">계약완료</option>
                        </select>
                      </td>

                      {/* 작업 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveEdit}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #2563eb',
                                background: '#dbeafe',
                                color: '#1d4ed8',
                                fontSize: 12,
                                cursor: 'pointer',
                                marginRight: 4,
                              }}
                            >
                              저장
                            </button>
                            <button
                              onClick={cancelEdit}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #d1d5db',
                                background: '#f9fafb',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(r)}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #60a5fa',
                                background: '#dbeafe',
                                color: '#1d4ed8',
                                fontSize: 12,
                                cursor: 'pointer',
                                marginRight: 4,
                              }}
                            >
                              수정
                            </button>
                            <button
                              onClick={() => onDelete(r.id)}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #f79d9dff',
                                color: '#b91c1c',
                                background: '#faececff',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: '12px 8px',
                        textAlign: 'center',
                        color: '#9ca3af',
                      }}
                    >
                      데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : isLandSaleType ? (
            /* ============ 건물매매 / 단독매매 / 토지 공통 매매 테이블 ============ */
            <table
              className="list-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <thead style={{ background: '#f3f4f6' }}>
                <tr>
                  {[
                    '번호',
                    '주소',
                    '대지면적(㎡)',
                    '매매가(만원)',
                    '평당가(만원)',
                    '연락처',
                    '비고',
                    '계약일',
                    '상태',
                    '작업',
                  ].map(h => (
                    <th
                      key={h}
                      className={h === '비고' ? 'col-note' : undefined}
                      style={{
                        border: '1px solid #9b9ea3',
                        padding: '6px 8px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => {
                  const isDone = r.status === '계약완료';
                  const isEditing = editingId === r.id;

                  return (
                    <tr
                      key={r.id}
                      style={{
                        background: isDone ? '#fef2f2' : '#ffffff',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      {/* 번호 */}
                      <td style={tdStyle(true)}>{idx + 1}</td>

                      {/* 주소 */}
                      <td style={tdStyle()}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.address ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                address: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.address
                        )}
                      </td>

                      {/* 대지면적 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.land_area_m2 ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                land_area_m2: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.land_area_m2 ?? '-'
                        )}
                      </td>

                      {/* 매매가 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.price_manwon ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                price_manwon: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          (r.price_manwon ?? '-') as string
                        )}
                      </td>

                      {/* 평당가 */}
                      <td style={tdStyle(true)}>{calcPyeongPrice(r)}</td>

                      {/* 연락처 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.contact ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                contact: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.contact ?? '-'
                        )}
                      </td>

                      {/* 비고 */}
                      <td style={tdStyle()} className="col-note">
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.note ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                note: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.note ?? '-'
                        )}
                      </td>

                      {/* 계약일 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            type="date"
                            style={cellInput}
                            value={editForm.contract_date ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                contract_date: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.contract_date ?? '-'
                        )}
                      </td>

                      {/* 상태 */}
                      <td style={tdStyle(true)}>
                        <select
                          value={r.status || '진행중'}
                          onChange={e =>
                            onChangeStatus(r.id, e.target.value as string)
                          }
                          style={{
                            padding: '3px 6px',
                            borderRadius: 4,
                            border:
                              r.status === '계약완료'
                                ? '1px solid #fca5a5'
                                : '1px solid #d1d5db',
                            color:
                              r.status === '계약완료' ? '#b91c1c' : '#111827',
                            background: '#ffffff',
                            fontSize: 12,
                          }}
                        >
                          <option value="진행중">진행중</option>
                          <option value="계약완료">계약완료</option>
                        </select>
                      </td>

                      {/* 작업 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveEdit}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #2563eb',
                                background: '#dbeafe',
                                color: '#1d4ed8',
                                fontSize: 12,
                                cursor: 'pointer',
                                marginRight: 4,
                              }}
                            >
                              저장
                            </button>
                            <button
                              onClick={cancelEdit}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #d1d5db',
                                background: '#f9fafb',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(r)}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #60a5fa',
                                background: '#dbeafe',
                                color: '#1d4ed8',
                                fontSize: 12,
                                cursor: 'pointer',
                                marginRight: 4,
                              }}
                            >
                              수정
                            </button>
                            <button
                              onClick={() => onDelete(r.id)}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #f79d9dff',
                                color: '#b91c1c',
                                background: '#faececff',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      style={{
                        padding: '12px 8px',
                        textAlign: 'center',
                        color: '#9ca3af',
                      }}
                    >
                      데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : isVillaSaleType ? (
            /* =================== 빌라 매매 전용 테이블 =================== */
            <table
              className="list-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <thead style={{ background: '#f3f4f6' }}>
                <tr>
                  {[
                    '번호',
                    '주소',
                    '전용면적(㎡)',
                    '대지지분(㎡)',
                    '층수',
                    '매매가(만원)',
                    '관리비',
                    '옵션',
                    '연락처',
                    '비고',
                    '계약일',
                    '상태',
                    '작업',
                  ].map(h => (
                    <th
                      key={h}
                      className={
                        h === '관리비'
                          ? 'col-maint'
                          : h === '옵션'
                          ? 'col-options'
                          : h === '비고'
                          ? 'col-note'
                          : undefined
                      }
                      style={{
                        border: '1px solid #9b9ea3',
                        padding: '6px 8px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => {
                  const isDone = r.status === '계약완료';
                  const isEditing = editingId === r.id;

                  return (
                    <tr
                      key={r.id}
                      style={{
                        background: isDone ? '#fef2f2' : '#ffffff',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <td style={tdStyle(true)}>{idx + 1}</td>

                      <td style={tdStyle()}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.address ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                address: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.address
                        )}
                      </td>

                      {/* 전용면적 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.gross_area_m2 ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                gross_area_m2: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.gross_area_m2 ?? '-'
                        )}
                      </td>

                      {/* 대지지분 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.land_area_m2 ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                land_area_m2: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.land_area_m2 ?? '-'
                        )}
                      </td>

                      {/* 층수 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.floor ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                floor: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.floor ?? '-'
                        )}
                      </td>

                      {/* 매매가 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.price_manwon ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                price_manwon: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          (r.price_manwon ?? '-') as string
                        )}
                      </td>

                      {/* 관리비 */}
                      <td style={tdStyle(true)} className="col-maint">
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.maintenance ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                maintenance: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.maintenance ?? '-'
                        )}
                      </td>

                      {/* 옵션 */}
                      <td style={tdStyle()} className="col-options">
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.options ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                options: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.options ?? '-'
                        )}
                      </td>

                      {/* 연락처 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.contact ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                contact: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.contact ?? '-'
                        )}
                      </td>

                      {/* 비고 */}
                      <td style={tdStyle()} className="col-note">
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.note ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                note: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.note ?? '-'
                        )}
                      </td>

                      {/* 계약일 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            type="date"
                            style={cellInput}
                            value={editForm.contract_date ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                contract_date: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.contract_date ?? '-'
                        )}
                      </td>

                      {/* 상태 */}
                      <td style={tdStyle(true)}>
                        <select
                          value={r.status || '진행중'}
                          onChange={e =>
                            onChangeStatus(r.id, e.target.value as string)
                          }
                          style={{
                            padding: '3px 6px',
                            borderRadius: 4,
                            border:
                              r.status === '계약완료'
                                ? '1px solid #fca5a5'
                                : '1px solid #d1d5db',
                            color:
                              r.status === '계약완료' ? '#b91c1c' : '#111827',
                            background: '#ffffff',
                            fontSize: 12,
                          }}
                        >
                          <option value="진행중">진행중</option>
                          <option value="계약완료">계약완료</option>
                        </select>
                      </td>

                      {/* 작업 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveEdit}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #2563eb',
                                background: '#dbeafe',
                                color: '#1d4ed8',
                                fontSize: 12,
                                cursor: 'pointer',
                                marginRight: 4,
                              }}
                            >
                              저장
                            </button>
                            <button
                              onClick={cancelEdit}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #d1d5db',
                                background: '#f9fafb',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(r)}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #60a5fa',
                                background: '#dbeafe',
                                color: '#1d4ed8',
                                fontSize: 12,
                                cursor: 'pointer',
                                marginRight: 4,
                              }}
                            >
                              수정
                            </button>
                            <button
                              onClick={() => onDelete(r.id)}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #f79d9dff',
                                color: '#b91c1c',
                                background: '#faececff',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={13}
                      style={{
                        padding: '12px 8px',
                        textAlign: 'center',
                        color: '#9ca3af',
                      }}
                    >
                      데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            /* ========== 원룸 / 투룸 / 쓰리룸 / 아파트 / 상가 / 사무실 테이블 ========== */
            <table
              className="list-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <thead style={{ background: '#f3f4f6' }}>
                <tr>
                  <th
                    style={{
                      border: '1px solid #9b9ea3',
                      padding: '6px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    번호
                  </th>
                  <th
                    style={{
                      border: '1px solid #9b9ea3',
                      padding: '6px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    주소
                  </th>
                  <th
                    style={{
                      border: '1px solid #9b9ea3',
                      padding: '6px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    전용면적(㎡)
                  </th>
                  <th
                    style={{
                      border: '1px solid #9b9ea3',
                      padding: '6px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    층수
                  </th>
                  <th
                    style={{
                      border: '1px solid #9b9ea3',
                      padding: '6px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    가격(만원)
                  </th>
                  <th
                    className="col-maint"
                    style={{
                      border: '1px solid #9b9ea3',
                      padding: '6px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    관리비
                  </th>
                  <th
                    className="col-options"
                    style={{
                      border: '1px solid #9b9ea3',
                      padding: '6px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isShopOrOffice ? '권리금(만원)' : '옵션'}
                  </th>
                  {/* 아파트는 건축물 용도 숨김 */}
                  {!isAptType && (
                    <th
                      className="col-bldg-use"
                      style={{
                        border: '1px solid #9b9ea3',
                        padding: '6px 8px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      건축물 용도
                    </th>
                  )}
                  <th
                    style={{
                      border: '1px solid #9b9ea3',
                      padding: '6px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    연락처
                  </th>
                  <th
                    className="col-note"
                    style={{
                      border: '1px solid #9b9ea3',
                      padding: '6px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    비고
                  </th>
                  <th
                    style={{
                      border: '1px solid #9b9ea3',
                      padding: '6px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    계약일
                  </th>
                  <th
                    className="col-expiry"
                    style={{
                      border: '1px solid #9b9ea3',
                      padding: '6px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    만료일
                  </th>
                  <th
                    style={{
                      border: '1px solid #9b9ea3',
                      padding: '6px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    상태
                  </th>
                  <th
                    style={{
                      border: '1px solid #9b9ea3',
                      padding: '6px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    작업
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => {
                  const isDone = r.status === '계약완료';
                  const isEditing = editingId === r.id;
                  const rowIsBiz = r.type === '상가' || r.type === '사무실';

                  return (
                    <tr
                      key={r.id}
                      style={{
                        background: isDone ? '#fef2f2' : '#ffffff',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <td style={tdStyle(true)}>{idx + 1}</td>

                      <td style={tdStyle()}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.address ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                address: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.address
                        )}
                      </td>

                      {/* 전용면적 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.gross_area_m2 ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                gross_area_m2: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.gross_area_m2 ?? '-'
                        )}
                      </td>

                      {/* 층수 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.floor ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                floor: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.floor ?? '-'
                        )}
                      </td>

                      {/* 가격 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.price_manwon ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                price_manwon: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          (r.price_manwon ?? '-') as string
                        )}
                      </td>

                      {/* 관리비 */}
                      <td style={tdStyle(true)} className="col-maint">
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.maintenance ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                maintenance: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.maintenance ?? '-'
                        )}
                      </td>

                      {/* 옵션 / 권리금 */}
                      <td style={tdStyle()} className="col-options">
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={
                              rowIsBiz
                                ? editForm.premium ?? ''
                                : editForm.options ?? ''
                            }
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                ...(rowIsBiz
                                  ? { premium: e.target.value }
                                  : { options: e.target.value }),
                              }))
                            }
                          />
                        ) : rowIsBiz ? (
                          r.premium ?? '-'
                        ) : (
                          r.options ?? '-'
                        )}
                      </td>

                      {/* 건축물 용도 – 아파트는 안 보임 */}
                      {!isAptType && (
                        <td style={tdStyle()} className="col-bldg-use">
                          {isEditing ? (
                            <input
                              style={cellInput}
                              value={editForm.bldg_use ?? ''}
                              onChange={e =>
                                setEditForm((f: any) => ({
                                  ...f,
                                  bldg_use: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            r.bldg_use ?? '-'
                          )}
                        </td>
                      )}

                      {/* 연락처 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.contact ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                contact: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.contact ?? '-'
                        )}
                      </td>

                      {/* 비고 */}
                      <td style={tdStyle()} className="col-note">
                        {isEditing ? (
                          <input
                            style={cellInput}
                            value={editForm.note ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                note: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.note ?? '-'
                        )}
                      </td>

                      {/* 계약일 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <input
                            type="date"
                            style={cellInput}
                            value={editForm.contract_date ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                contract_date: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.contract_date ?? '-'
                        )}
                      </td>

                      {/* 만료일 */}
                      <td style={tdStyle(true)} className="col-expiry">
                        {isEditing ? (
                          <input
                            type="date"
                            style={cellInput}
                            value={editForm.expiry_date ?? ''}
                            onChange={e =>
                              setEditForm((f: any) => ({
                                ...f,
                                expiry_date: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          r.expiry_date ?? '-'
                        )}
                      </td>

                      {/* 상태 */}
                      <td style={tdStyle(true)}>
                        <select
                          value={r.status || '진행중'}
                          onChange={e =>
                            onChangeStatus(r.id, e.target.value as string)
                          }
                          style={{
                            padding: '3px 6px',
                            borderRadius: 4,
                            border:
                              r.status === '계약완료'
                                ? '1px solid #fca5a5'
                                : '1px solid #d1d5db',
                            color:
                              r.status === '계약완료' ? '#b91c1c' : '#111827',
                            background: '#ffffff',
                            fontSize: 12,
                          }}
                        >
                          <option value="진행중">진행중</option>
                          <option value="계약완료">계약완료</option>
                        </select>
                      </td>

                      {/* 작업 */}
                      <td style={tdStyle(true)}>
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveEdit}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #2563eb',
                                background: '#dbeafe',
                                color: '#1d4ed8',
                                fontSize: 12,
                                cursor: 'pointer',
                                marginRight: 4,
                              }}
                            >
                              저장
                            </button>
                            <button
                              onClick={cancelEdit}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #d1d5db',
                                background: '#f9fafb',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(r)}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #60a5fa',
                                background: '#dbeafe',
                                color: '#1d4ed8',
                                fontSize: 12,
                                cursor: 'pointer',
                                marginRight: 4,
                              }}
                            >
                              수정
                            </button>
                            <button
                              onClick={() => onDelete(r.id)}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: '1px solid #f79d9dff',
                                color: '#b91c1c',
                                background: '#faececff',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={isAptType ? 13 : 14}
                      style={{
                        padding: '12px 8px',
                        textAlign: 'center',
                        color: '#9ca3af',
                      }}
                    >
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
      </main>

      {/* 🔽 모바일 전용 스타일 */}
      <style jsx global>{`
        @media (max-width: 640px) {
          main {
            padding: 12px !important;
          }

          .table-container {
            border-width: 1px;
          }

          .list-table {
            font-size: 11px;
          }

          .list-table th,
          .list-table td {
            padding: 4px 6px !important;
          }

          /* 덜 중요한 컬럼은 모바일에서 숨김 */
          .col-note,
          .col-bldg-use,
          .col-maint,
          .col-options,
          .col-expiry {
            display: none;
          }
        }
      `}</style>
    </>
  );
}

// ✅ 셀 공통 스타일
function tdStyle(center = false): CSSProperties {
  return {
    padding: '6px 8px',
    border: '1px solid #9b9ea3',
    textAlign: center ? 'center' : 'left',
    whiteSpace: 'nowrap',
  };
}

/** 매물 추가 다이얼로그 */
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

  const hideBldgUse = isLandSaleType || isAptType; // 🔥 아파트도 건축물용도 숨김

  const set = (k: string, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.type) {
      alert('유형은 필수입니다.');
      return;
    }
    if (!form.address) {
      alert('주소는 필수입니다.');
      return;
    }

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

  const wrap: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  };
  const card: CSSProperties = {
    width: 680,
    maxWidth: '95vw',
    background: '#fff',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 10px 30px rgba(0,0,0,.15)',
  };
  const grid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: 8,
    alignItems: 'center',
  };
  const ip: CSSProperties = {
    padding: '8px 10px',
    border: '1px solid #ddd',
    borderRadius: 8,
    width: '100%',
  };
  const btn: CSSProperties = {
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
  };

  return (
    <div style={wrap} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>매물 추가</h2>

        <div style={{ ...grid, marginBottom: 8 }}>
          {/* 유형 */}
          <label>유형</label>
          <select
            value={form.type}
            onChange={e => set('type', e.target.value)}
            style={ip}
          >
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

          {/* 주소 */}
          <label>주소</label>
          <input
            value={form.address}
            onChange={e => set('address', e.target.value)}
            style={ip}
            placeholder="예: 서울 광진구 자양동 123-4"
          />

          {/* 가격 */}
          <label>
            {isLandSaleType || isVillaSaleType ? '매매가(만원)' : '가격(만원)'}
          </label>
          <input
            value={form.price_manwon}
            onChange={e => set('price_manwon', e.target.value)}
            style={ip}
            placeholder={
              isLandSaleType || isVillaSaleType ? '예: 30000' : '예: 5000/120'
            }
          />

          {/* 면적 */}
          {isLandSaleType ? (
            <>
              <label>대지면적(㎡)</label>
              <input
                value={form.land_area_m2}
                onChange={e => set('land_area_m2', e.target.value)}
                style={ip}
                inputMode="numeric"
              />

              {!isLandOnly && (
                <>
                  <label>연면적(㎡)</label>
                  <input
                    value={form.gross_area_m2}
                    onChange={e => set('gross_area_m2', e.target.value)}
                    style={ip}
                    inputMode="numeric"
                  />
                </>
              )}
            </>
          ) : isVillaSaleType ? (
            <>
              <label>전용면적(㎡)</label>
              <input
                value={form.gross_area_m2}
                onChange={e => set('gross_area_m2', e.target.value)}
                style={ip}
                inputMode="numeric"
              />

              <label>대지지분(㎡)</label>
              <input
                value={form.land_area_m2}
                onChange={e => set('land_area_m2', e.target.value)}
                style={ip}
                inputMode="numeric"
              />
            </>
          ) : (
            <>
              {/* 원룸/투룸/쓰리룸/아파트/상가/사무실: 전용면적 */}
              <label>전용면적(㎡)</label>
              <input
                value={form.gross_area_m2}
                onChange={e => set('gross_area_m2', e.target.value)}
                style={ip}
                inputMode="numeric"
              />
            </>
          )}

          {/* 층수 (토지만 없음) */}
          {!isLandOnly && (
            <>
              <label>층수</label>
              <input
                value={form.floor}
                onChange={e => set('floor', e.target.value)}
                style={ip}
                placeholder="예: 3층 / 반지하 등"
              />
            </>
          )}

          {/* 관리비 (매매 타입은 없이) */}
          {!isLandSaleType && (
            <>
              <label>관리비(만원)</label>
              <input
                value={form.maintenance}
                onChange={e => set('maintenance', e.target.value)}
                style={ip}
                placeholder="예: 5만원 / 없음"
              />
            </>
          )}

          {/* 옵션 / 권리금 */}
          {isLandSaleType ? null : isBizLease ? (
            <>
              <label>권리금(만원)</label>
              <input
                value={form.premium}
                onChange={e => set('premium', e.target.value)}
                style={ip}
                placeholder="예: 3000 / 없음"
              />
            </>
          ) : (
            <>
              <label>옵션</label>
              <input
                value={form.options}
                onChange={e => set('options', e.target.value)}
                style={ip}
                placeholder="예: 풀옵션, 세탁기, TV"
              />
            </>
          )}

          {/* 건축물 용도 (건물/단독/토지/아파트는 안 씀) */}
          {!hideBldgUse && (
            <>
              <label>건축물 용도</label>
              <input
                value={form.bldg_use}
                onChange={e => set('bldg_use', e.target.value)}
                style={ip}
                placeholder="예: 다세대주택, 근린생활시설"
              />
            </>
          )}

          {/* 연락처 */}
          <label>연락처</label>
          <input
            value={form.contact}
            onChange={e => set('contact', e.target.value)}
            style={ip}
            placeholder="010-0000-0000"
          />

          {/* 계약일 / 만료일 */}
          <label>계약일</label>
          <input
            type="date"
            value={form.contract_date}
            onChange={e => set('contract_date', e.target.value)}
            style={ip}
          />

          <label>만료일</label>
          <input
            type="date"
            value={form.expiry_date}
            onChange={e => set('expiry_date', e.target.value)}
            style={ip}
          />

          {/* 비고 */}
          <label>비고</label>
          <input
            value={form.note}
            onChange={e => set('note', e.target.value)}
            style={ip}
            placeholder="옵션/특이사항 등"
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 6,
          }}
        >
          <button style={btn} onClick={onClose}>
            닫기
          </button>
          <button
            style={{ ...btn, borderColor: '#2563eb', color: '#2563eb' }}
            onClick={save}
            disabled={saving}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function num(v: any) {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replaceAll(',', ''));
  return Number.isFinite(n) ? n : null;
}

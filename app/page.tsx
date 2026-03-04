'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

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
] as const;

const CREATE_TYPES = TYPES;

export default function Home() {
  const router = useRouter();

  // ------- 로그인 여부 확인 (기존 유지) --------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ok = localStorage.getItem('adminAuthed');
    if (ok !== 'yes') window.location.assign('/login');
  }, []);
  // --------------------------------------------

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [type, setType] = useState<(typeof TYPES)[number]>('원룸');
  const [q, setQ] = useState('');
  const [openAdd, setOpenAdd] = useState(false);

  // 인라인 수정
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // 전체 검색 모드 여부
  const [isSearchMode, setIsSearchMode] = useState(false);

  const isLandSaleType = type === '건물매매' || type === '단독매매' || type === '토지';
  const isVillaSaleType = type === '빌라매매';
  const isShopOrOffice = type === '상가' || type === '사무실';
  const isAptType = type === '아파트';
  const isLandOnly = type === '토지';

  const prettyType = (t: string) =>
    t === '건물매매' ? '건물 매매'
    : t === '단독매매' ? '단독 매매'
    : t === '빌라매매' ? '빌라 매매'
    : t === '토지' ? '토지 매매'
    : t;

  const calcPyeongPrice = (r: any) => {
    if (!r.land_area_m2 || !r.price_manwon) return '-';
    const price = parseFloat(String(r.price_manwon).replaceAll(',', ''));
    const land = Number(r.land_area_m2);
    if (!Number.isFinite(price) || !Number.isFinite(land) || land === 0) return '-';
    const pyeong = land / 3.3058;
    const per = Math.round(price / pyeong);
    return per.toLocaleString();
  };

  /** 목록 불러오기 */
  const load = async () => {
    setLoading(true);

    let query = supabase.from('listings').select('*').order('created_at', { ascending: false });
    const keyword = q.trim();

    if (keyword) {
      setIsSearchMode(true);
      query = query.or(
        `address.ilike.%${keyword}%,note.ilike.%${keyword}%,contact.ilike.%${keyword}%`
      );
    } else {
      setIsSearchMode(false);
      query = query.eq('type', type);
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
    setIsSearchMode(false);
    setQ('');
    setEditingId(null);
    setEditForm({});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  /** 상태 변경 */
  const onChangeStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('listings').update({ status: newStatus }).eq('id', id);
    if (error) return alert('상태 변경 실패: ' + error.message);
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status: newStatus } : r)));
  };

  /** 삭제 */
  const onDelete = async (id: string) => {
    if (!confirm('정말 삭제할까요?')) return;
    const { error } = await supabase.from('listings').delete().eq('id', id);
    if (error) return alert('삭제 실패: ' + error.message);
    setRows(prev => prev.filter(r => r.id !== id));
  };

  /** 초기화 */
  const resetFilters = () => {
    setType('원룸');
    setQ('');
    setIsSearchMode(false);
    setEditingId(null);
    setEditForm({});
    // type 바뀌면 load 되니까 여기서는 그냥 처리만
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
      land_area_m2: editForm.land_area_m2 === '' ? null : Number(editForm.land_area_m2),
      gross_area_m2: editForm.gross_area_m2 === '' ? null : Number(editForm.gross_area_m2),
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

    const { error } = await supabase.from('listings').update(payload).eq('id', editingId);
    if (error) return alert('수정 실패: ' + error.message);

    setRows(prev => prev.map(r => (r.id === editingId ? { ...r, ...payload } : r)));
    setEditingId(null);
    setEditForm({});
  };

  const filteredCountText = useMemo(() => {
    if (loading) return '불러오는 중…';
    if (isSearchMode) return `검색 결과 ${rows.length}건`;
    return `총 ${rows.length}건`;
  }, [loading, isSearchMode, rows.length]);

  const cellInputClass =
    "w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-black/10";

  const statusSelectClass =
    "border border-gray-300 rounded px-2 py-1 text-xs bg-white";

  // ===== 모바일 카드에서 보여줄 핵심 필드 묶기 =====
  const cardTitle = (r: any) => `${r.type ?? '-'} · ${r.address ?? '-'}`;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="w-full max-w-[1600px] mx-auto space-y-4">

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">매물 관리</h1>
            <div className="text-sm text-gray-500">중앙공인중개사사무소 전용 사이트입니다!</div>
          </div>

          <button
            onClick={() => setOpenAdd(true)}
            className="bg-black text-white px-3 py-2 rounded"
          >
            + 매물 추가
          </button>
        </div>

        {/* 탭 */}
        <div className="flex flex-wrap gap-2 border rounded p-3">
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={[
                "px-3 py-1 rounded text-sm border",
                type === t ? "bg-black text-white border-black" : "bg-white hover:bg-gray-50"
              ].join(" ")}
            >
              {prettyType(t)}
            </button>
          ))}
        </div>

        {/* 검색 / 버튼 */}
        <div className="border rounded p-3 space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') load(); }}
              placeholder="주소 / 비고 / 연락처 검색 (전체 검색)"
              className="border rounded px-3 py-2 text-sm w-full md:flex-1"
            />
            <button onClick={load} className="border rounded px-4 py-2 text-sm hover:bg-gray-50 whitespace-nowrap">
              검색
            </button>
            <button onClick={resetFilters} className="border rounded px-4 py-2 text-sm hover:bg-gray-50 whitespace-nowrap">
              초기화
            </button>
            <button onClick={load} className="border rounded px-4 py-2 text-sm hover:bg-gray-50 whitespace-nowrap">
              새로고침
            </button>
          </div>

          <div className="text-sm text-gray-600">{filteredCountText}</div>
        </div>

        {/* ✅ 모바일: 카드뷰 */}
        <div className="md:hidden space-y-2">
          {loading ? (
            <div className="border rounded p-3 text-sm">불러오는중...</div>
          ) : rows.length === 0 ? (
            <div className="border rounded p-3 text-sm">데이터 없음</div>
          ) : (
            rows.map((r) => {
              const isDone = r.status === '계약완료';
              const isEditing = editingId === r.id;

              return (
                <div key={r.id} className={`border rounded p-3 space-y-2 ${isDone ? "bg-red-50" : ""}`}>
                  <div className="font-semibold text-sm">{cardTitle(r)}</div>

                  <div className="text-xs text-gray-700 space-y-1">
                    <div>가격: {r.price_manwon ?? "-"}</div>
                    <div>층수: {r.floor ?? "-"}</div>
                    <div>연락처: {r.contact ?? "-"}</div>
                    <div>비고: {r.note ?? "-"}</div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={r.status || '진행중'}
                      onChange={e => onChangeStatus(r.id, e.target.value)}
                      className={statusSelectClass}
                    >
                      <option value="진행중">진행중</option>
                      <option value="계약완료">계약완료</option>
                    </select>

                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} className="border rounded px-3 py-1 text-sm">저장</button>
                          <button onClick={cancelEdit} className="border rounded px-3 py-1 text-sm">취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)} className="border rounded px-3 py-1 text-sm">수정</button>
                          <button onClick={() => onDelete(r.id)} className="border rounded px-3 py-1 text-sm text-red-600">삭제</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 모바일 인라인 편집 폼(간단) */}
                  {isEditing && (
                    <div className="grid grid-cols-1 gap-2 pt-2">
                      <input className={cellInputClass} value={editForm.address ?? ''} onChange={e => setEditForm((f:any)=>({...f,address:e.target.value}))} placeholder="주소" />
                      <input className={cellInputClass} value={editForm.price_manwon ?? ''} onChange={e => setEditForm((f:any)=>({...f,price_manwon:e.target.value}))} placeholder="가격(만원)" />
                      <input className={cellInputClass} value={editForm.floor ?? ''} onChange={e => setEditForm((f:any)=>({...f,floor:e.target.value}))} placeholder="층수" />
                      <input className={cellInputClass} value={editForm.contact ?? ''} onChange={e => setEditForm((f:any)=>({...f,contact:e.target.value}))} placeholder="연락처" />
                      <input className={cellInputClass} value={editForm.note ?? ''} onChange={e => setEditForm((f:any)=>({...f,note:e.target.value}))} placeholder="비고" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ✅ PC: 테이블뷰 */}
        <div className="hidden md:block overflow-auto border rounded">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {/* 헤더를 현재 모드에 맞춰서 동적으로 */}
                {isSearchMode ? (
                  ["번호","유형","주소","가격(만원)","층수","건축물 용도","연락처","상태","작업"].map(h => (
                    <th key={h} className="border border-gray-300 py-2 px-3 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))
                ) : isLandSaleType ? (
                  ["번호","주소","대지면적(㎡)", ...(isLandOnly ? [] : ["연면적(㎡)"]), "매매가(만원)","평당가(만원)","연락처","비고","계약일","상태","작업"].map(h => (
                    <th key={h} className="border border-gray-300 py-2 px-3 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))
                ) : isVillaSaleType ? (
                  ["번호","주소","전용면적(㎡)","대지지분(㎡)","층수","매매가(만원)","관리비","옵션","연락처","비고","계약일","상태","작업"].map(h => (
                    <th key={h} className="border border-gray-300 py-2 px-3 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))
                ) : (
                  ["번호","주소","전용면적(㎡)","층수","가격(만원)","관리비", isShopOrOffice ? "권리금(만원)" : "옵션", ...(isAptType ? [] : ["건축물 용도"]), "연락처","비고","계약일","만료일","상태","작업"].map(h => (
                    <th key={h} className="border border-gray-300 py-2 px-3 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))
                )}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={20} className="border border-gray-300 py-3 px-3">불러오는중...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={20} className="border border-gray-300 py-3 px-3">데이터 없음</td></tr>
              ) : (
                rows.map((r, idx) => {
                  const isDone = r.status === '계약완료';
                  const isEditing = editingId === r.id;
                  const rowIsBiz = r.type === '상가' || r.type === '사무실';
                  const rowIsApt = r.type === '아파트';

                  const td = "border border-gray-300 py-2 px-3 whitespace-nowrap";
                  const tdL = "border border-gray-300 py-2 px-3";
                  const rowClass = isDone ? "bg-red-50" : "";

                  // ====== 전체검색용 테이블 ======
                  if (isSearchMode) {
                    return (
                      <tr key={r.id} className={`hover:bg-gray-50 ${rowClass}`}>
                        <td className={td}>{idx + 1}</td>
                        <td className={td}>{r.type ?? "-"}</td>

                        <td className={tdL}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.address ?? ''} onChange={e=>setEditForm((f:any)=>({...f,address:e.target.value}))}/>
                          ) : (r.address ?? "-")}
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.price_manwon ?? ''} onChange={e=>setEditForm((f:any)=>({...f,price_manwon:e.target.value}))}/>
                          ) : (r.price_manwon ?? "-")}
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.floor ?? ''} onChange={e=>setEditForm((f:any)=>({...f,floor:e.target.value}))}/>
                          ) : (r.floor ?? "-")}
                        </td>

                        <td className={tdL}>
                          {rowIsApt ? "-" : (isEditing ? (
                            <input className={cellInputClass} value={editForm.bldg_use ?? ''} onChange={e=>setEditForm((f:any)=>({...f,bldg_use:e.target.value}))}/>
                          ) : (r.bldg_use ?? "-"))}
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.contact ?? ''} onChange={e=>setEditForm((f:any)=>({...f,contact:e.target.value}))}/>
                          ) : (r.contact ?? "-")}
                        </td>

                        <td className={td}>
                          <select className={statusSelectClass} value={r.status || '진행중'} onChange={e=>onChangeStatus(r.id, e.target.value)}>
                            <option value="진행중">진행중</option>
                            <option value="계약완료">계약완료</option>
                          </select>
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <>
                              <button onClick={saveEdit} className="text-blue-600 mr-2">저장</button>
                              <button onClick={cancelEdit} className="text-gray-600">취소</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(r)} className="text-blue-600 mr-2">수정</button>
                              <button onClick={() => onDelete(r.id)} className="text-red-600">삭제</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  // ====== 토지/건물 매매 테이블 ======
                  if (isLandSaleType) {
                    return (
                      <tr key={r.id} className={`hover:bg-gray-50 ${rowClass}`}>
                        <td className={td}>{idx + 1}</td>

                        <td className={tdL}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.address ?? ''} onChange={e=>setEditForm((f:any)=>({...f,address:e.target.value}))}/>
                          ) : (r.address ?? "-")}
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.land_area_m2 ?? ''} onChange={e=>setEditForm((f:any)=>({...f,land_area_m2:e.target.value}))}/>
                          ) : (r.land_area_m2 ?? "-")}
                        </td>

                        {!isLandOnly && (
                          <td className={td}>
                            {isEditing ? (
                              <input className={cellInputClass} value={editForm.gross_area_m2 ?? ''} onChange={e=>setEditForm((f:any)=>({...f,gross_area_m2:e.target.value}))}/>
                            ) : (r.gross_area_m2 ?? "-")}
                          </td>
                        )}

                        <td className={td}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.price_manwon ?? ''} onChange={e=>setEditForm((f:any)=>({...f,price_manwon:e.target.value}))}/>
                          ) : (r.price_manwon ?? "-")}
                        </td>

                        <td className={td}>{calcPyeongPrice(r)}</td>

                        <td className={td}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.contact ?? ''} onChange={e=>setEditForm((f:any)=>({...f,contact:e.target.value}))}/>
                          ) : (r.contact ?? "-")}
                        </td>

                        <td className={tdL}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.note ?? ''} onChange={e=>setEditForm((f:any)=>({...f,note:e.target.value}))}/>
                          ) : (r.note ?? "-")}
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <input type="date" className={cellInputClass} value={editForm.contract_date ?? ''} onChange={e=>setEditForm((f:any)=>({...f,contract_date:e.target.value}))}/>
                          ) : (r.contract_date ?? "-")}
                        </td>

                        <td className={td}>
                          <select className={statusSelectClass} value={r.status || '진행중'} onChange={e=>onChangeStatus(r.id, e.target.value)}>
                            <option value="진행중">진행중</option>
                            <option value="계약완료">계약완료</option>
                          </select>
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <>
                              <button onClick={saveEdit} className="text-blue-600 mr-2">저장</button>
                              <button onClick={cancelEdit} className="text-gray-600">취소</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(r)} className="text-blue-600 mr-2">수정</button>
                              <button onClick={() => onDelete(r.id)} className="text-red-600">삭제</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  // ====== 빌라매매 테이블 ======
                  if (isVillaSaleType) {
                    return (
                      <tr key={r.id} className={`hover:bg-gray-50 ${rowClass}`}>
                        <td className={td}>{idx + 1}</td>

                        <td className={tdL}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.address ?? ''} onChange={e=>setEditForm((f:any)=>({...f,address:e.target.value}))}/>
                          ) : (r.address ?? "-")}
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.gross_area_m2 ?? ''} onChange={e=>setEditForm((f:any)=>({...f,gross_area_m2:e.target.value}))}/>
                          ) : (r.gross_area_m2 ?? "-")}
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.land_area_m2 ?? ''} onChange={e=>setEditForm((f:any)=>({...f,land_area_m2:e.target.value}))}/>
                          ) : (r.land_area_m2 ?? "-")}
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.floor ?? ''} onChange={e=>setEditForm((f:any)=>({...f,floor:e.target.value}))}/>
                          ) : (r.floor ?? "-")}
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.price_manwon ?? ''} onChange={e=>setEditForm((f:any)=>({...f,price_manwon:e.target.value}))}/>
                          ) : (r.price_manwon ?? "-")}
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.maintenance ?? ''} onChange={e=>setEditForm((f:any)=>({...f,maintenance:e.target.value}))}/>
                          ) : (r.maintenance ?? "-")}
                        </td>

                        <td className={tdL}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.options ?? ''} onChange={e=>setEditForm((f:any)=>({...f,options:e.target.value}))}/>
                          ) : (r.options ?? "-")}
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.contact ?? ''} onChange={e=>setEditForm((f:any)=>({...f,contact:e.target.value}))}/>
                          ) : (r.contact ?? "-")}
                        </td>

                        <td className={tdL}>
                          {isEditing ? (
                            <input className={cellInputClass} value={editForm.note ?? ''} onChange={e=>setEditForm((f:any)=>({...f,note:e.target.value}))}/>
                          ) : (r.note ?? "-")}
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <input type="date" className={cellInputClass} value={editForm.contract_date ?? ''} onChange={e=>setEditForm((f:any)=>({...f,contract_date:e.target.value}))}/>
                          ) : (r.contract_date ?? "-")}
                        </td>

                        <td className={td}>
                          <select className={statusSelectClass} value={r.status || '진행중'} onChange={e=>onChangeStatus(r.id, e.target.value)}>
                            <option value="진행중">진행중</option>
                            <option value="계약완료">계약완료</option>
                          </select>
                        </td>

                        <td className={td}>
                          {isEditing ? (
                            <>
                              <button onClick={saveEdit} className="text-blue-600 mr-2">저장</button>
                              <button onClick={cancelEdit} className="text-gray-600">취소</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(r)} className="text-blue-600 mr-2">수정</button>
                              <button onClick={() => onDelete(r.id)} className="text-red-600">삭제</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  // ====== 일반 임대(원룸/투룸/쓰리룸/아파트/상가/사무실) ======
                  return (
                    <tr key={r.id} className={`hover:bg-gray-50 ${rowClass}`}>
                      <td className={td}>{idx + 1}</td>

                      <td className={tdL}>
                        {isEditing ? (
                          <input className={cellInputClass} value={editForm.address ?? ''} onChange={e=>setEditForm((f:any)=>({...f,address:e.target.value}))}/>
                        ) : (r.address ?? "-")}
                      </td>

                      <td className={td}>
                        {isEditing ? (
                          <input className={cellInputClass} value={editForm.gross_area_m2 ?? ''} onChange={e=>setEditForm((f:any)=>({...f,gross_area_m2:e.target.value}))}/>
                        ) : (r.gross_area_m2 ?? "-")}
                      </td>

                      <td className={td}>
                        {isEditing ? (
                          <input className={cellInputClass} value={editForm.floor ?? ''} onChange={e=>setEditForm((f:any)=>({...f,floor:e.target.value}))}/>
                        ) : (r.floor ?? "-")}
                      </td>

                      <td className={td}>
                        {isEditing ? (
                          <input className={cellInputClass} value={editForm.price_manwon ?? ''} onChange={e=>setEditForm((f:any)=>({...f,price_manwon:e.target.value}))}/>
                        ) : (r.price_manwon ?? "-")}
                      </td>

                      <td className={td}>
                        {isEditing ? (
                          <input className={cellInputClass} value={editForm.maintenance ?? ''} onChange={e=>setEditForm((f:any)=>({...f,maintenance:e.target.value}))}/>
                        ) : (r.maintenance ?? "-")}
                      </td>

                      <td className={tdL}>
                        {isEditing ? (
                          <input
                            className={cellInputClass}
                            value={rowIsBiz ? (editForm.premium ?? '') : (editForm.options ?? '')}
                            onChange={e=>setEditForm((f:any)=>({...f, ...(rowIsBiz ? {premium:e.target.value} : {options:e.target.value}) }))}
                          />
                        ) : (rowIsBiz ? (r.premium ?? "-") : (r.options ?? "-"))}
                      </td>

                      {!isAptType && (
                        <td className={tdL}>
                          {rowIsApt ? "-" : (
                            isEditing ? (
                              <input className={cellInputClass} value={editForm.bldg_use ?? ''} onChange={e=>setEditForm((f:any)=>({...f,bldg_use:e.target.value}))}/>
                            ) : (r.bldg_use ?? "-")
                          )}
                        </td>
                      )}

                      <td className={td}>
                        {isEditing ? (
                          <input className={cellInputClass} value={editForm.contact ?? ''} onChange={e=>setEditForm((f:any)=>({...f,contact:e.target.value}))}/>
                        ) : (r.contact ?? "-")}
                      </td>

                      <td className={tdL}>
                        {isEditing ? (
                          <input className={cellInputClass} value={editForm.note ?? ''} onChange={e=>setEditForm((f:any)=>({...f,note:e.target.value}))}/>
                        ) : (r.note ?? "-")}
                      </td>

                      <td className={td}>
                        {isEditing ? (
                          <input type="date" className={cellInputClass} value={editForm.contract_date ?? ''} onChange={e=>setEditForm((f:any)=>({...f,contract_date:e.target.value}))}/>
                        ) : (r.contract_date ?? "-")}
                      </td>

                      <td className={td}>
                        {isEditing ? (
                          <input type="date" className={cellInputClass} value={editForm.expiry_date ?? ''} onChange={e=>setEditForm((f:any)=>({...f,expiry_date:e.target.value}))}/>
                        ) : (r.expiry_date ?? "-")}
                      </td>

                      <td className={td}>
                        <select className={statusSelectClass} value={r.status || '진행중'} onChange={e=>onChangeStatus(r.id, e.target.value)}>
                          <option value="진행중">진행중</option>
                          <option value="계약완료">계약완료</option>
                        </select>
                      </td>

                      <td className={td}>
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} className="text-blue-600 mr-2">저장</button>
                            <button onClick={cancelEdit} className="text-gray-600">취소</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(r)} className="text-blue-600 mr-2">수정</button>
                            <button onClick={() => onDelete(r.id)} className="text-red-600">삭제</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
      </div>
    </div>
  );
}

/** 매물 추가 다이얼로그 - 디자인만 테일윈드로 변경 */
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

  const isLandSaleType = form.type === '건물매매' || form.type === '단독매매' || form.type === '토지';
  const isVillaSaleType = form.type === '빌라매매';
  const isBizLease = form.type === '상가' || form.type === '사무실';
  const isLandOnly = form.type === '토지';
  const isAptType = form.type === '아파트';

  const hideBldgUse = isLandSaleType || isAptType;

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.type) return alert('유형은 필수');
    if (!form.address) return alert('주소는 필수');

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

    if (error) return alert('저장 실패: ' + error.message);
    onSaved();
  };

  const inputClass =
    "border rounded px-3 py-2 text-sm w-full";
  const labelClass = "text-sm text-gray-600";

  const types = CREATE_TYPES;

  const prettyType = (t: string) =>
    t === '건물매매' ? '건물 매매'
    : t === '단독매매' ? '단독 매매'
    : t === '빌라매매' ? '빌라 매매'
    : t === '토지' ? '토지 매매'
    : t;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl p-5 space-y-3" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">매물 추가</h2>
          <button onClick={onClose} className="border rounded px-3 py-1 text-sm">닫기</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className={labelClass}>유형</div>
            <select className={inputClass} value={form.type} onChange={e=>set('type', e.target.value)}>
              <option value="">선택</option>
              {types.map(t => <option key={t} value={t}>{prettyType(t)}</option>)}
            </select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <div className={labelClass}>주소</div>
            <input className={inputClass} value={form.address} onChange={e=>set('address', e.target.value)} />
          </div>

          <div className="space-y-1">
            <div className={labelClass}>{isLandSaleType || isVillaSaleType ? '매매가(만원)' : '가격(만원)'}</div>
            <input className={inputClass} value={form.price_manwon} onChange={e=>set('price_manwon', e.target.value)} />
          </div>

          {/* 면적 */}
          {isLandSaleType ? (
            <>
              <div className="space-y-1">
                <div className={labelClass}>대지면적(㎡)</div>
                <input className={inputClass} value={form.land_area_m2} onChange={e=>set('land_area_m2', e.target.value)} />
              </div>
              {!isLandOnly && (
                <div className="space-y-1">
                  <div className={labelClass}>연면적(㎡)</div>
                  <input className={inputClass} value={form.gross_area_m2} onChange={e=>set('gross_area_m2', e.target.value)} />
                </div>
              )}
            </>
          ) : isVillaSaleType ? (
            <>
              <div className="space-y-1">
                <div className={labelClass}>전용면적(㎡)</div>
                <input className={inputClass} value={form.gross_area_m2} onChange={e=>set('gross_area_m2', e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className={labelClass}>대지지분(㎡)</div>
                <input className={inputClass} value={form.land_area_m2} onChange={e=>set('land_area_m2', e.target.value)} />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <div className={labelClass}>전용면적(㎡)</div>
              <input className={inputClass} value={form.gross_area_m2} onChange={e=>set('gross_area_m2', e.target.value)} />
            </div>
          )}

          {!isLandOnly && (
            <div className="space-y-1">
              <div className={labelClass}>층수</div>
              <input className={inputClass} value={form.floor} onChange={e=>set('floor', e.target.value)} />
            </div>
          )}

          {!isLandSaleType && (
            <div className="space-y-1">
              <div className={labelClass}>관리비</div>
              <input className={inputClass} value={form.maintenance} onChange={e=>set('maintenance', e.target.value)} />
            </div>
          )}

          {!isLandSaleType && (
            <div className="space-y-1">
              <div className={labelClass}>{isBizLease ? '권리금(만원)' : '옵션'}</div>
              <input className={inputClass} value={isBizLease ? form.premium : form.options} onChange={e=>set(isBizLease ? 'premium' : 'options', e.target.value)} />
            </div>
          )}

          {!hideBldgUse && (
            <div className="space-y-1">
              <div className={labelClass}>건축물 용도</div>
              <input className={inputClass} value={form.bldg_use} onChange={e=>set('bldg_use', e.target.value)} />
            </div>
          )}

          <div className="space-y-1">
            <div className={labelClass}>연락처</div>
            <input className={inputClass} value={form.contact} onChange={e=>set('contact', e.target.value)} />
          </div>

          <div className="space-y-1">
            <div className={labelClass}>계약일</div>
            <input type="date" className={inputClass} value={form.contract_date} onChange={e=>set('contract_date', e.target.value)} />
          </div>

          <div className="space-y-1">
            <div className={labelClass}>만료일</div>
            <input type="date" className={inputClass} value={form.expiry_date} onChange={e=>set('expiry_date', e.target.value)} />
          </div>

          <div className="space-y-1 md:col-span-2">
            <div className={labelClass}>비고</div>
            <input className={inputClass} value={form.note} onChange={e=>set('note', e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className="border rounded px-4 py-2 text-sm" onClick={onClose}>취소</button>
          <button className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-60" onClick={save} disabled={saving}>
            {saving ? "저장중..." : "저장"}
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

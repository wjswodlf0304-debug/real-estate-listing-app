'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';

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

const LABEL = (t: string) =>
  t === '건물매매'
    ? '건물 매매'
    : t === '단독매매'
    ? '단독 매매'
    : t === '빌라매매'
    ? '빌라 매매'
    : t === '토지'
    ? '토지 매매'
    : t;

type ListingRow = {
  id: string;
  type: string | null;
  address: string | null;
  land_area_m2: number | null;
  gross_area_m2: number | null;
  floor: string | null;
  price_manwon: string | null; // "5000/65" 같은 문자열도 있음
  maintenance: string | null;
  options: string | null;
  premium: string | null;
  bldg_use: string | null;
  contact: string | null;
  note: string | null;
  contract_date: string | null;
  expiry_date: string | null;
  status: string | null; // "진행중" | "계약완료"
  created_at?: string | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function Page() {
  const supabase = createClient();

  const [type, setType] = useState<string>('원룸');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ListingRow[]>([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ListingRow | null>(null);

  const isSearchMode = q.trim().length > 0;

  const isLandSaleType =
    type === '건물매매' || type === '단독매매' || type === '토지';
  const isLandOnly = type === '토지';
  const isVillaSaleType = type === '빌라매매';
  const isShopOrOffice = type === '상가' || type === '사무실';
  const isAptType = type === '아파트';

  const load = async () => {
    setLoading(true);

    let query = supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });

    const keyword = q.trim();

    if (keyword) {
      query = query.or(
        `address.ilike.%${keyword}%,note.ilike.%${keyword}%,contact.ilike.%${keyword}%`
      );
    } else {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      alert('불러오기 실패: ' + error.message);
      setRows([]);
    } else {
      setRows((data || []) as ListingRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    // 탭 바꾸면 검색어 비우고 탭 기준 로드
    setQ('');
    setEditing(null);
    setOpen(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    // 최초 1회
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setType('원룸');
    setQ('');
    setEditing(null);
    setOpen(false);
    // 탭 useEffect가 load 하니까 여기서 한 번만
    // (type 바꾸는 순간 load 됨)
  };

  const onDelete = async (r: ListingRow) => {
    if (!confirm('삭제할까?')) return;
    const { error } = await supabase.from('listings').delete().eq('id', r.id);
    if (error) return alert('삭제 실패: ' + error.message);
    setRows(prev => prev.filter(x => x.id !== r.id));
  };

  const onChangeStatus = async (r: ListingRow, s: string) => {
    const { error } = await supabase
      .from('listings')
      .update({ status: s })
      .eq('id', r.id);

    if (error) return alert('상태 변경 실패: ' + error.message);

    setRows(prev => prev.map(x => (x.id === r.id ? { ...x, status: s } : x)));
  };

  const calcPyeongPrice = (r: ListingRow) => {
    if (!r.land_area_m2 || !r.price_manwon) return '-';
    const price = parseFloat(String(r.price_manwon).replaceAll(',', ''));
    const land = Number(r.land_area_m2);
    if (!Number.isFinite(price) || !Number.isFinite(land) || land === 0)
      return '-';
    const pyeong = land / 3.3058;
    const per = Math.round(price / pyeong);
    return per.toLocaleString();
  };

  // 검색 모드에서는 간단 테이블(유형 포함)
  const tableMode = useMemo(() => {
    if (isSearchMode) return 'search';
    if (isLandSaleType) return 'land';
    if (isVillaSaleType) return 'villa';
    return 'lease';
  }, [isSearchMode, isLandSaleType, isVillaSaleType]);

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[1400px] space-y-4">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">매물 관리</h1>
            <p className="text-sm text-gray-500">
              탭/검색으로 빠르게 필터하고 표에서 바로 관리
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
              className="rounded-lg border border-blue-600 bg-white px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              + 매물 추가
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex flex-wrap gap-2">
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cx(
                'rounded-lg border px-3 py-2 text-sm',
                t === type
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
              )}
            >
              {LABEL(t)}
            </button>
          ))}
        </div>

        {/* 검색줄 */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') load();
            }}
            placeholder="주소 / 비고 / 연락처 검색 (전체에서 검색)"
            className="w-full flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={load}
              className="min-w-[84px] whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              검색
            </button>
            <button
              onClick={reset}
              className="min-w-[84px] whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              검색초기화
            </button>
          </div>
        </div>

        {/* 카운트 */}
        <div className="text-sm text-gray-600">
          {loading
            ? '불러오는 중…'
            : isSearchMode
            ? `검색 결과 ${rows.length}건`
            : `총 ${rows.length}건`}
        </div>

        {/* 테이블 */}
        <div className="overflow-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50">
              {tableMode === 'search' ? (
                <tr className="border-b border-gray-200">
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
                      className="whitespace-nowrap border-r border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              ) : tableMode === 'land' ? (
                <tr className="border-b border-gray-200">
                  {[
                    '번호',
                    '주소',
                    '대지면적(㎡)',
                    ...(isLandOnly ? [] : ['연면적(㎡)']),
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
                      className="whitespace-nowrap border-r border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              ) : tableMode === 'villa' ? (
                <tr className="border-b border-gray-200">
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
                      className="whitespace-nowrap border-r border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              ) : (
                <tr className="border-b border-gray-200">
                  {[
                    '번호',
                    '주소',
                    '전용면적(㎡)',
                    '층수',
                    '가격(만원)',
                    '관리비',
                    isShopOrOffice ? '권리금(만원)' : '옵션',
                    ...(isAptType ? [] : ['건축물 용도']),
                    '연락처',
                    '비고',
                    '계약일',
                    '만료일',
                    '상태',
                    '작업',
                  ].map(h => (
                    <th
                      key={h}
                      className="whitespace-nowrap border-r border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              )}
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={30}>
                    불러오는중...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={30}>
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const done = r.status === '계약완료';
                  return (
                    <tr
                      key={r.id}
                      className={cx(
                        'border-b border-gray-100',
                        done ? 'bg-red-50/40' : 'bg-white',
                        'hover:bg-gray-50'
                      )}
                    >
                      {/* 공통 셀 스타일: 줄선 확실히 */}
                      <Td>{idx + 1}</Td>

                      {tableMode === 'search' ? (
                        <>
                          <Td>{r.type ?? '-'}</Td>
                          <Td className="min-w-[260px]">{r.address ?? '-'}</Td>
                          <Td>{r.price_manwon ?? '-'}</Td>
                          <Td>{r.floor ?? '-'}</Td>
                          <Td>{r.type === '아파트' ? '-' : r.bldg_use ?? '-'}</Td>
                          <Td className="font-medium">{r.contact ?? '-'}</Td>
                          <Td>
                            <StatusSelect
                              value={r.status || '진행중'}
                              onChange={v => onChangeStatus(r, v)}
                            />
                          </Td>
                          <Td>
                            <RowActions
                              onEdit={() => {
                                setEditing(r);
                                setOpen(true);
                              }}
                              onDelete={() => onDelete(r)}
                            />
                          </Td>
                        </>
                      ) : tableMode === 'land' ? (
                        <>
                          <Td className="min-w-[260px]">{r.address ?? '-'}</Td>
                          <Td>{r.land_area_m2 ?? '-'}</Td>
                          {!isLandOnly && <Td>{r.gross_area_m2 ?? '-'}</Td>}
                          <Td>{r.price_manwon ?? '-'}</Td>
                          <Td>{calcPyeongPrice(r)}</Td>
                          <Td className="font-medium">{r.contact ?? '-'}</Td>
                          <Td className="min-w-[220px]">{r.note ?? '-'}</Td>
                          <Td>{r.contract_date ?? '-'}</Td>
                          <Td>
                            <StatusSelect
                              value={r.status || '진행중'}
                              onChange={v => onChangeStatus(r, v)}
                            />
                          </Td>
                          <Td>
                            <RowActions
                              onEdit={() => {
                                setEditing(r);
                                setOpen(true);
                              }}
                              onDelete={() => onDelete(r)}
                            />
                          </Td>
                        </>
                      ) : tableMode === 'villa' ? (
                        <>
                          <Td className="min-w-[260px]">{r.address ?? '-'}</Td>
                          <Td>{r.gross_area_m2 ?? '-'}</Td>
                          <Td>{r.land_area_m2 ?? '-'}</Td>
                          <Td>{r.floor ?? '-'}</Td>
                          <Td>{r.price_manwon ?? '-'}</Td>
                          <Td>{r.maintenance ?? '-'}</Td>
                          <Td className="min-w-[180px]">{r.options ?? '-'}</Td>
                          <Td className="font-medium">{r.contact ?? '-'}</Td>
                          <Td className="min-w-[220px]">{r.note ?? '-'}</Td>
                          <Td>{r.contract_date ?? '-'}</Td>
                          <Td>
                            <StatusSelect
                              value={r.status || '진행중'}
                              onChange={v => onChangeStatus(r, v)}
                            />
                          </Td>
                          <Td>
                            <RowActions
                              onEdit={() => {
                                setEditing(r);
                                setOpen(true);
                              }}
                              onDelete={() => onDelete(r)}
                            />
                          </Td>
                        </>
                      ) : (
                        <>
                          <Td className="min-w-[260px]">{r.address ?? '-'}</Td>
                          <Td>{r.gross_area_m2 ?? '-'}</Td>
                          <Td>{r.floor ?? '-'}</Td>
                          <Td>{r.price_manwon ?? '-'}</Td>
                          <Td>{r.maintenance ?? '-'}</Td>
                          <Td className="min-w-[180px]">
                            {isShopOrOffice ? r.premium ?? '-' : r.options ?? '-'}
                          </Td>
                          {!isAptType && (
                            <Td className="min-w-[160px]">{r.bldg_use ?? '-'}</Td>
                          )}
                          <Td className="font-medium">{r.contact ?? '-'}</Td>
                          <Td className="min-w-[220px]">{r.note ?? '-'}</Td>
                          <Td>{r.contract_date ?? '-'}</Td>
                          <Td>{r.expiry_date ?? '-'}</Td>
                          <Td>
                            <StatusSelect
                              value={r.status || '진행중'}
                              onChange={v => onChangeStatus(r, v)}
                            />
                          </Td>
                          <Td>
                            <RowActions
                              onEdit={() => {
                                setEditing(r);
                                setOpen(true);
                              }}
                              onDelete={() => onDelete(r)}
                            />
                          </Td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 모달 */}
      {open && (
        <ListingModal
          open={open}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setOpen(false);
            setEditing(null);
            await load();
          }}
          currentType={type}
          editing={editing}
        />
      )}
    </div>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cx(
        'whitespace-nowrap border-r border-gray-100 px-3 py-2 text-gray-800 last:border-r-0',
        className
      )}
    >
      {children}
    </td>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const done = value === '계약완료';
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cx(
        'rounded-md border px-2 py-1 text-sm',
        done ? 'border-red-300 text-red-700' : 'border-gray-300 text-gray-800'
      )}
    >
      <option value="진행중">진행중</option>
      <option value="계약완료">계약완료</option>
    </select>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onEdit} className="text-blue-600 hover:underline">
        수정
      </button>
      <button onClick={onDelete} className="text-red-600 hover:underline">
        삭제
      </button>
    </div>
  );
}

function ListingModal({
  open,
  onClose,
  onSaved,
  currentType,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  currentType: string;
  editing: ListingRow | null;
}) {
  const supabase = createClient();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: editing?.type || currentType || '',
    address: editing?.address || '',
    price_manwon: editing?.price_manwon || '',
    land_area_m2: editing?.land_area_m2 ? String(editing.land_area_m2) : '',
    gross_area_m2: editing?.gross_area_m2 ? String(editing.gross_area_m2) : '',
    floor: editing?.floor || '',
    maintenance: editing?.maintenance || '',
    options: editing?.options || '',
    premium: editing?.premium || '',
    bldg_use: editing?.bldg_use || '',
    contact: editing?.contact || '',
    note: editing?.note || '',
    contract_date: editing?.contract_date || '',
    expiry_date: editing?.expiry_date || '',
    status: editing?.status || '진행중',
  });

  useEffect(() => {
    // 편집 열었을 때 값 갱신
    setForm({
      type: editing?.type || currentType || '',
      address: editing?.address || '',
      price_manwon: editing?.price_manwon || '',
      land_area_m2: editing?.land_area_m2 ? String(editing.land_area_m2) : '',
      gross_area_m2: editing?.gross_area_m2 ? String(editing.gross_area_m2) : '',
      floor: editing?.floor || '',
      maintenance: editing?.maintenance || '',
      options: editing?.options || '',
      premium: editing?.premium || '',
      bldg_use: editing?.bldg_use || '',
      contact: editing?.contact || '',
      note: editing?.note || '',
      contract_date: editing?.contract_date || '',
      expiry_date: editing?.expiry_date || '',
      status: editing?.status || '진행중',
    });
  }, [editing, currentType]);

  const isLandSaleType =
    form.type === '건물매매' || form.type === '단독매매' || form.type === '토지';
  const isLandOnly = form.type === '토지';
  const isVillaSaleType = form.type === '빌라매매';
  const isBizLease = form.type === '상가' || form.type === '사무실';
  const isAptType = form.type === '아파트';
  const hideBldgUse = isLandSaleType || isAptType;

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.type) return alert('유형은 필수');
    if (!form.address.trim()) return alert('주소는 필수');

    setSaving(true);

    const payload: any = {
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
      status: form.status || '진행중',
    };

    let error: any = null;

    if (editing?.id) {
      const res = await supabase.from('listings').update(payload).eq('id', editing.id);
      error = res.error;
    } else {
      const res = await supabase.from('listings').insert([payload]);
      error = res.error;
    }

    setSaving(false);

    if (error) return alert('저장 실패: ' + error.message);

    onSaved();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-3 sm:p-6">
      <div className="mx-auto flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <div className="font-bold">{editing ? '매물 수정' : '매물 추가'}</div>
          <button
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
          >
            닫기
          </button>
        </div>

        {/* ✅ 여기만 스크롤 */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="유형">
              <select
                value={form.type}
                onChange={e => set('type', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">선택</option>
                {TYPES.map(t => (
                  <option key={t} value={t}>
                    {LABEL(t)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="연락처">
              <input
                value={form.contact}
                onChange={e => set('contact', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="010-0000-0000"
              />
            </Field>

            <Field label="주소" className="sm:col-span-2">
              <input
                value={form.address}
                onChange={e => set('address', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="예: 자양동 123-4"
              />
            </Field>

            <Field label={isLandSaleType || isVillaSaleType ? '매매가(만원)' : '가격(만원)'}>
              <input
                value={form.price_manwon}
                onChange={e => set('price_manwon', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder={isLandSaleType || isVillaSaleType ? '예: 30000' : '예: 5000/65'}
              />
            </Field>

            {!isLandSaleType && (
              <Field label="관리비">
                <input
                  value={form.maintenance}
                  onChange={e => set('maintenance', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            )}

            {isLandSaleType ? (
              <>
                <Field label="대지면적(㎡)">
                  <input
                    value={form.land_area_m2}
                    onChange={e => set('land_area_m2', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    inputMode="numeric"
                  />
                </Field>
                {!isLandOnly && (
                  <Field label="연면적(㎡)">
                    <input
                      value={form.gross_area_m2}
                      onChange={e => set('gross_area_m2', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      inputMode="numeric"
                    />
                  </Field>
                )}
              </>
            ) : isVillaSaleType ? (
              <>
                <Field label="전용면적(㎡)">
                  <input
                    value={form.gross_area_m2}
                    onChange={e => set('gross_area_m2', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="대지지분(㎡)">
                  <input
                    value={form.land_area_m2}
                    onChange={e => set('land_area_m2', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    inputMode="numeric"
                  />
                </Field>
              </>
            ) : (
              <Field label="전용면적(㎡)">
                <input
                  value={form.gross_area_m2}
                  onChange={e => set('gross_area_m2', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  inputMode="numeric"
                />
              </Field>
            )}

            {!isLandOnly && (
              <Field label="층수">
                <input
                  value={form.floor}
                  onChange={e => set('floor', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="예: 3층 / 반지하"
                />
              </Field>
            )}

            {!isLandSaleType && (
              <Field label={isBizLease ? '권리금(만원)' : '옵션'}>
                <input
                  value={isBizLease ? form.premium : form.options}
                  onChange={e =>
                    set(isBizLease ? 'premium' : 'options', e.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            )}

            {!hideBldgUse && (
              <Field label="건축물 용도">
                <input
                  value={form.bldg_use}
                  onChange={e => set('bldg_use', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            )}

            <Field label="계약일">
              <input
                type="date"
                value={form.contract_date}
                onChange={e => set('contract_date', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="만료일">
              <input
                type="date"
                value={form.expiry_date}
                onChange={e => set('expiry_date', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="상태">
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="진행중">진행중</option>
                <option value="계약완료">계약완료</option>
              </select>
            </Field>

            <Field label="비고" className="sm:col-span-2">
              <textarea
                value={form.note}
                onChange={e => set('note', e.target.value)}
                className="min-h-[80px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </div>

        {/* 하단 고정 버튼 */}
        <div className="flex justify-end gap-2 border-t bg-white p-4">
          <button
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1 text-xs font-medium text-gray-600">{label}</div>
      {children}
    </div>
  );
}

function num(v: any) {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replaceAll(',', ''));
  return Number.isFinite(n) ? n : null;
}

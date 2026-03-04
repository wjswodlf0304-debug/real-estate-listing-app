'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const TYPES = ['원룸','투룸','쓰리룸','상가','사무실','건물매매','토지'];
const STATUSES = ['진행중','계약완료'];

export default function Home() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);

  // 필터
  const [type, setType] = useState<'전체'|string>('전체');
  const [status, setStatus] = useState<'전체'|string>('전체');
  const [q, setQ] = useState('');

  // 추가 모달
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState({
    type: '원룸',
    address: '',
    price_manwon: '',
    land_area_m2: '',
    gross_area_m2: '',
    floor: '',
    options: '',
    bldg_use: '',
    contact: '',
    note: '',
    status: '진행중',
  });
  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toNumOrNull = (v: string) => {
    const n = parseFloat((v ?? '').toString().replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  // 조회
  const fetchData = async () => {
    setLoading(true);
    let qy = supabase.from('listings').select('*').order('created_at', { ascending: false });
    if (type !== '전체') qy = qy.eq('type', type);
    if (status !== '전체') qy = qy.eq('status', status);
    if (q.trim()) qy = qy.or(`address.ilike.%${q}%,note.ilike.%${q}%`);
    const { data, error } = await qy;
    if (error) console.error(error);
    setListings(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchData(); }, [type, status]);

  const resetFilter = () => { setType('전체'); setStatus('전체'); setQ(''); fetchData(); };

  const saveNew = async () => {
    const payload: any = {
      type: form.type,
      address: form.address || null,
      price_manwon: toNumOrNull(form.price_manwon),
      land_area_m2: toNumOrNull(form.land_area_m2),
      gross_area_m2: toNumOrNull(form.gross_area_m2),
      floor: form.floor || null,
      options: form.options || null,
      bldg_use: form.bldg_use || null,
      contact: form.contact || null,
      note: form.note || null,
      status: form.status,
    };
    const { error } = await supabase.from('listings').insert([payload]);
    if (error) { alert('저장 실패: ' + error.message); return; }
    setOpenAdd(false);
    setForm({ ...form, address:'', price_manwon:'', land_area_m2:'', gross_area_m2:'', floor:'', options:'', bldg_use:'', contact:'', note:'' });
    fetchData();
  };

  const filtered = useMemo(() => listings, [listings]);

  // 스타일
  const barWrap = {
    border: '1px solid #e5e7eb',
    background: '#fafafa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  } as const;

  return (
    <main style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
        <h1 style={{ fontSize: 22, margin: 0 }}>매물 목록</h1>
        <button
          onClick={() => setOpenAdd(true)}
          style={{ padding:'10px 14px', border:'1px solid #222', borderRadius:10, background:'#111', color:'#fff', cursor:'pointer' }}
        >
          + 매물 추가
        </button>
      </div>

      {/* 상단 필터 바 */}
      <div style={barWrap}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 140px 1fr 200px',
          gap: 10,
          alignItems: 'center'
        }}>
          <select value={type} onChange={e=>setType(e.target.value)} style={{ padding:10, border:'1px solid #ddd', borderRadius:8 }}>
            <option value="전체">전체</option>
            {TYPES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          <select value={status} onChange={e=>setStatus(e.target.value)} style={{ padding:10, border:'1px solid #ddd', borderRadius:8 }}>
            <option value="전체">전체</option>
            {STATUSES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter') fetchData(); }}
            placeholder="주소/메모 검색"
            style={{ padding:10, border:'1px solid #ddd', borderRadius:8, width:'100%' }}
          />

          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={fetchData} style={{ padding:'10px 12px', border:'1px solid #ddd', borderRadius:8, background:'#fff', cursor:'pointer' }}>검색</button>
            <button onClick={resetFilter} style={{ padding:'10px 12px', border:'1px solid #ddd', borderRadius:8, background:'#fff', cursor:'pointer' }}>초기화</button>
          </div>
        </div>
      </div>

      {/* 결과 요약 */}
      <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
        {loading ? '불러오는 중…' : `총 ${filtered.length}건`}
      </div>

      {/* 목록 */}
      <ul style={{ listStyle:'none', padding:0, margin:0 }}>
        {filtered.map(item => (
          <li key={item.id}
              style={{ padding:'12px 14px', border:'1px solid #e5e7eb', borderRadius:12, marginBottom:10,
                       background: item.status==='계약완료' ? '#ffe6e6' : '#fff' }}>
            <div style={{ fontWeight:600 }}>{item.type} | {item.address}</div>
            <div style={{ fontSize:13, color:'#444', marginTop:6, display:'flex', gap:10, flexWrap:'wrap' }}>
              <span>가격 {item.price_manwon ?? '-'}만원</span>
              {item.land_area_m2 && <span>대지 {item.land_area_m2}㎡</span>}
              {item.gross_area_m2 && <span>연면적 {item.gross_area_m2}㎡</span>}
              {item.floor && <span>층수 {item.floor}</span>}
              {item.bldg_use && <span>용도 {item.bldg_use}</span>}
              {item.options && <span>옵션 {item.options}</span>}
              {item.contact && <span>연락처 {item.contact}</span>}
              {item.status && <span>상태 {item.status}</span>}
            </div>
            {item.note && <div style={{ marginTop:6, color:'#666' }}>{item.note}</div>}
          </li>
        ))}
        {!loading && filtered.length===0 && <li style={{ color:'#888', padding:'16px 0' }}>검색 결과 없음</li>}
      </ul>

      {/* 매물 추가 모달 */}
      {openAdd && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.25)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:50
        }}>
          <div style={{ width: 720, background:'#fff', borderRadius:14, padding:18, boxShadow:'0 10px 30px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <h2 style={{ margin:0, fontSize:18 }}>매물 추가</h2>
              <button onClick={()=>setOpenAdd(false)} style={{ border:'1px solid #ddd', padding:'6px 10px', borderRadius:8, background:'#fff', cursor:'pointer' }}>닫기</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label>유형</label>
                <select value={form.type} onChange={e=>setF('type', e.target.value)} style={ipt}/>
              </div>
              <div>
                <label>상태</label>
                <select value={form.status} onChange={e=>setF('status', e.target.value)} style={ipt}>
                  {STATUSES.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'1 / span 2' }}>
                <label>주소</label>
                <input value={form.address} onChange={e=>setF('address', e.target.value)} style={ipt}/>
              </div>
              <div>
                <label>가격(만원)</label>
                <input value={form.price_manwon} onChange={e=>setF('price_manwon', e.target.value)} style={ipt}/>
              </div>
              <div>
                <label>대지면적(㎡)</label>
                <input value={form.land_area_m2} onChange={e=>setF('land_area_m2', e.target.value)} style={ipt}/>
              </div>
              <div>
                <label>연면적(㎡)</label>
                <input value={form.gross_area_m2} onChange={e=>setF('gross_area_m2', e.target.value)} style={ipt}/>
              </div>
              <div>
                <label>층수</label>
                <input value={form.floor} onChange={e=>setF('floor', e.target.value)} style={ipt}/>
              </div>
              <div>
                <label>건축물 용도</label>
                <input value={form.bldg_use} onChange={e=>setF('bldg_use', e.target.value)} style={ipt}/>
              </div>
              <div>
                <label>옵션</label>
                <input value={form.options} onChange={e=>setF('options', e.target.value)} style={ipt}/>
              </div>
              <div>
                <label>연락처</label>
                <input value={form.contact} onChange={e=>setF('contact', e.target.value)} style={ipt}/>
              </div>
              <div style={{ gridColumn:'1 / span 2' }}>
                <label>비고</label>
                <textarea value={form.note} onChange={e=>setF('note', e.target.value)} style={{...ipt, minHeight:80}}/>
              </div>
            </div>

            <div style={{ marginTop:14, display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setOpenAdd(false)} style={{ padding:'10px 14px', border:'1px solid #ddd', borderRadius:8, background:'#fff', cursor:'pointer' }}>취소</button>
              <button onClick={saveNew} style={{ padding:'10px 14px', border:'1px solid #0a0', borderRadius:8, background:'#0a0', color:'#fff', cursor:'pointer' }}>저장</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const ipt: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  border: '1px solid #ddd',
  borderRadius: 8,
  marginTop: 6,
};

// ====== 추가: 폼 옵션 상수 ======
const TYPE_OPTIONS = ['원룸','투룸','쓰리룸','상가','사무실','건물매매','토지'];
const STATUS_OPTIONS = ['진행중','계약완료'];

// ====== 추가: 매물추가 폼 컴포넌트 ======
function AddListing({ onClose, onSaved }) {
  const [form, setForm] = useState({
    type: TYPE_OPTIONS[0],   // 기본값 세팅 중요!
    status: STATUS_OPTIONS[0],
    address: '',
    price_manwon: '',
    land_area_m2: '',
    gross_area_m2: '',
    floor: '',
    options: '',
    bldg_use: '',
    contact: '',
    note: '',
  });
  const [saving, setSaving] = useState(false);

  const box = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
  };
  const panel = { background: '#fff', width: 520, maxWidth: '92vw', borderRadius: 12, padding: 16, boxShadow: '0 6px 24px rgba(0,0,0,.18)' };
  const row = { display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, alignItems: 'center', marginBottom: 10 };
  const input = { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8 };
  const btn = { padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' };

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const toNum = (v) => v === '' ? null : Number(v);

  const save = async () => {
    setSaving(true);
    const payload = {
      type: form.type,
      status: form.status,
      address: form.address,
      price_manwon: toNum(form.price_manwon),
      land_area_m2: toNum(form.land_area_m2),
      gross_area_m2: toNum(form.gross_area_m2),
      // 아래 4개 컬럼은 DB에 없으면 주석 처리하거나, Supabase에서 먼저 컬럼을 추가해
      floor: form.floor,
      options: form.options,
      bldg_use: form.bldg_use,
      contact: form.contact,
      note: form.note,
    };
    const { error } = await supabase.from('listings').insert([payload]);
    setSaving(false);
    if (error) { alert('저장 실패: ' + error.message); return; }
    onSaved(); onClose();
  };

  return (
    <div style={box} onClick={onClose}>
      <div style={panel} onClick={(e)=>e.stopPropagation()}>
        <h3 style={{margin:'0 0 12px'}}>매물 추가</h3>

        <div style={row}>
          <label>유형</label>
          <select style={input} value={form.type} onChange={set('type')}>
            {/* 옵션이 비지 않도록 고정 배열을 직접 매핑 */}
            <option value="" disabled>유형 선택</option>
            {TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div style={row}>
          <label>상태</label>
          <select style={input} value={form.status} onChange={set('status')}>
            {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div style={row}><label>주소</label><input style={input} value={form.address} onChange={set('address')} placeholder="예) 서울 광진구 자양동" /></div>
        <div style={row}><label>가격(만원)</label><input style={input} value={form.price_manwon} onChange={set('price_manwon')} type="number" /></div>
        <div style={row}><label>대지㎡</label><input style={input} value={form.land_area_m2} onChange={set('land_area_m2')} type="number" /></div>
        <div style={row}><label>연면적㎡</label><input style={input} value={form.gross_area_m2} onChange={set('gross_area_m2')} type="number" /></div>

        {/* DB에 컬럼 있으면 사용 */}
        <div style={row}><label>층수</label><input style={input} value={form.floor} onChange={set('floor')} /></div>
        <div style={row}><label>옵션</label><input style={input} value={form.options} onChange={set('options')} placeholder="풀옵션, 세탁기, TV" /></div>
        <div style={row}><label>건축물 용도</label><input style={input} value={form.bldg_use} onChange={set('bldg_use')} /></div>
        <div style={row}><label>연락처</label><input style={input} value={form.contact} onChange={set('contact')} /></div>
        <div style={row}><label>비고</label><input style={input} value={form.note} onChange={set('note')} /></div>

        <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:12}}>
          <button style={btn} onClick={onClose}>취소</button>
          <button style={{...btn, background:'#111', color:'#fff'}} onClick={save} disabled={saving}>
            {saving ? '저장중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}


http://localhost:3000/
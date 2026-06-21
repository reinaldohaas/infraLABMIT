import { useState, useRef } from 'react';
import { Camera, Send, CheckCircle, AlertTriangle, UploadCloud } from 'lucide-react';
import { db, ensureAuth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function EventReporter({ deviceInfo, location }) {
  const [expanded, setExpanded] = useState(false);
  const [eventType, setEventType] = useState('tempestade');
  const [description, setDescription] = useState('');
  const [base64Image, setBase64Image] = useState(null);
  const [preview, setPreview] = useState(null);
  
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      // Cria um URL temporário para mostrar o preview imediatamente
      setPreview(URL.createObjectURL(selected));
      
      // Comprime a imagem
      const img = new Image();
      img.src = URL.createObjectURL(selected);
      img.onload = () => {
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Comprime forte (60% qualidade JPEG) para caber bem no Firestore
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setBase64Image(dataUrl);
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === 'uploading') return;

    setStatus('uploading');
    try {
      let authUid = 'anonymous_fallback';
      try {
        const uid = await ensureAuth();
        if (uid) authUid = uid;
      } catch (e) {
        console.warn('Auth failed, using fallback UID');
      }

      // Save report to Firestore, including the base64 string
      await addDoc(collection(db, 'labmit_user_reports'), {
        type: eventType,
        description: description.trim(),
        photo_base64: base64Image, // O texto longo com a imagem comprimida
        timestamp: serverTimestamp(),
        station_uuid: deviceInfo?.uuid || 'unknown',
        location_name: location || 'Desconhecida',
        _auth_uid: authUid,
      });

      setStatus('success');
      setTimeout(() => {
        setExpanded(false);
        setEventType('tempestade');
        setDescription('');
        setBase64Image(null);
        setPreview(null);
        setStatus('idle');
      }, 3000);
    } catch (err) {
      console.error('[EventReporter] Erro:', err);
      setStatus(`error: ${err.message}`);
    }
  };

  if (!expanded) {
    return (
      <div 
        style={{ padding: '12px 16px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={() => setExpanded(true)}
      >
        <Camera size={16} /> Relatar um Evento (Ciência Cidadã)
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Camera size={16} /> Relatório Cidadão
        </h3>
        <button onClick={() => setExpanded(false)} style={{ background: 'transparent', color: 'var(--text-muted)', padding: 4 }}>✕</button>
      </div>

      {status === 'success' ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#4caf50' }}>
          <CheckCircle size={32} style={{ marginBottom: 8 }} />
          <div>Relatório enviado com sucesso!</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Obrigado por contribuir com a pesquisa.</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          <select 
            value={eventType} 
            onChange={e => setEventType(e.target.value)}
            style={{ width: '100%', padding: 8, background: 'var(--bg-input)', color: '#fff', border: '1px solid var(--border)', borderRadius: 4 }}
          >
            <option value="tempestade">🌩️ Tempestade Severa</option>
            <option value="raio">⚡ Raio Próximo</option>
            <option value="estrondo">🔊 Estrondo Misterioso</option>
            <option value="tremor">🫨 Tremor / Vibração</option>
            <option value="vento">🌪️ Ventania Extrema</option>
            <option value="outro">Outro...</option>
          </select>

          <textarea 
            placeholder="Descreva o que aconteceu..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            required
            style={{ width: '100%', padding: 8, background: 'var(--bg-input)', color: '#fff', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit', resize: 'vertical' }}
          />

          <div 
            onClick={() => fileInputRef.current?.click()}
            style={{ border: '1px dashed var(--border)', borderRadius: 4, padding: '16px', textAlign: 'center', cursor: 'pointer', background: preview ? '#000' : 'transparent', position: 'relative' }}
          >
            {preview ? (
              <img src={preview} alt="Preview" style={{ maxHeight: 150, maxWidth: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Camera size={20} />
                <span>Anexar Foto (Opcional)</span>
                <span style={{ fontSize: 9, color: 'var(--accent)' }}>Foto será comprimida p/ economizar dados</span>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }} 
            />
          </div>

          {status.startsWith('error') && (
            <div style={{ color: 'var(--danger)', fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
              <AlertTriangle size={12} /> Falha: {status.replace('error: ', '')}
            </div>
          )}

          <button 
            type="submit" 
            disabled={status === 'uploading' || !description.trim()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, background: 'var(--accent)', color: '#000', fontWeight: 'bold' }}
          >
            {status === 'uploading' ? (
              <><UploadCloud size={16} /> Enviando...</>
            ) : (
              <><Send size={16} /> Enviar Relatório</>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

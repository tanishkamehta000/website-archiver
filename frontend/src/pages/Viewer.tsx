// helps view snapshot frame
import { useParams } from 'react-router-dom'

export default function Viewer() {
  // read route
  const { host, ts } = useParams<{ host: string, ts: string }>()
  
  // build static file
  const src = `${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/archive/${host}/${ts}/local/index.html`
  return (
    <div style={{ height: '80vh' }}>
      <iframe src={src} style={{ width: '100%', height: '100%', border: '1px solid #ddd' }} sandbox="allow-same-origin allow-forms allow-pointer-lock allow-scripts"></iframe>
    </div>
  )
}

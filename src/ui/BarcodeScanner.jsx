import { useEffect, useRef, useState } from 'react'

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

export default function BarcodeScanner({ onDetect, onCancel }) {
  const videoRef = useRef(null)
  // Колбек через ref, щоб зміна пропса не перезапускала камеру:
  // повторний запит потоку на телефоні виглядає як блимання екрана.
  const detectRef = useRef(onDetect)
  detectRef.current = onDetect

  const [error, setError] = useState(null)

  useEffect(() => {
    let stopped = false
    let stream = null
    let controls = null

    function emit(raw) {
      if (stopped) return
      stopped = true
      detectRef.current(raw)
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Браузер не дає доступу до камери')
        return
      }

      try {
        // Вбудований розпізнавач є в Android Chrome і не коштує нічого.
        // На iOS його немає — там вантажимо бібліотеку, але лише тут.
        if ('BarcodeDetector' in window) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          })
          videoRef.current.srcObject = stream
          await videoRef.current.play()

          const detector = new window.BarcodeDetector({ formats: FORMATS })
          const tick = async () => {
            if (stopped) return
            try {
              const found = await detector.detect(videoRef.current)
              if (found.length) return emit(found[0].rawValue)
            } catch {
              // Окремий невдалий кадр — це норма, просто пробуємо наступний.
            }
            requestAnimationFrame(tick)
          }
          tick()
          return
        }

        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          result => { if (result) emit(result.getText()) }
        )
      } catch (err) {
        setError(
          err.name === 'NotAllowedError'
            ? 'Доступ до камери заборонено. Дозволь його в налаштуваннях браузера'
            : 'Не вдалося увімкнути камеру: ' + err.message
        )
      }
    }

    start()

    return () => {
      stopped = true
      stream?.getTracks().forEach(track => track.stop())
      controls?.stop()
    }
  }, [])

  return (
    <div className="scanner">
      {error
        ? <p className="error">{error}</p>
        : <>
            <video ref={videoRef} className="scanner__video" playsInline muted />
            <div className="scanner__frame" aria-hidden="true" />
            <p className="muted">Наведи камеру на штрихкод</p>
          </>}
      <button className="ghost" onClick={onCancel}>Скасувати</button>
    </div>
  )
}

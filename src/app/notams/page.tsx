
import { PageHeader } from '@/components/common/page-header';

const NOTAM_IFRAME_URL = "https://ais.anac.gob.ar/notam?lugar=LIO";

export default function NotamsPage() {
  return (
    <>
      <PageHeader title="NOTAMs (LIO)" />
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <iframe
          src={NOTAM_IFRAME_URL}
          className="w-full h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)] border-0"
          title="NOTAMs AIS Argentina para LIO"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        >
          <p>
            Tu navegador no soporta iframes o el contenido no se pudo cargar. 
            Puedes acceder directamente a los NOTAMs en 
            <a href={NOTAM_IFRAME_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
              AIS Argentina
            </a>.
          </p>
        </iframe>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Nota: La visualización y funcionalidad del contenido de NOTAMs dependen del sitio externo AIS Argentina.
        Si la preselección para LIO no funciona, deberás seleccionar manualmente "NUEVE DE JULIO" dentro del recuadro.
      </p>
    </>
  );
}

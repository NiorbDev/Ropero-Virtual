import { useEffect, useState } from 'react';

interface PhotoPreviewProps {
  alt: string;
  className?: string;
  reference: string;
  resolvePhoto: (reference: string) => Promise<string>;
}

export function PhotoPreview({ alt, className, reference, resolvePhoto }: PhotoPreviewProps) {
  const [source, setSource] = useState('');

  useEffect(() => {
    let active = true;
    setSource('');
    void resolvePhoto(reference).then((resolved) => {
      if (active) setSource(resolved);
    }).catch(() => {
      if (active) setSource('');
    });
    return () => { active = false; };
  }, [reference, resolvePhoto]);

  if (!source) return <span className={`${className ?? ''} studio-photo-loading`} aria-label={`Cargando foto de ${alt}`} />;
  return <img className={className} src={source} alt={alt} draggable={false} />;
}

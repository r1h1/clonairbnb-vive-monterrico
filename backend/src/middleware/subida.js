import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';

// Guarda archivos en disco. Nota para produccion: en hosting gratuito con
// disco efimero (ej. Render free) las imagenes se pierden al reiniciar; ahi
// conviene usar un almacenamiento externo (Cloudinary/Supabase Storage).
function almacenamiento(subcarpeta) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join('uploads', subcarpeta)),
    filename: (req, file, cb) => {
      const id = crypto.randomBytes(8).toString('hex');
      cb(null, `${Date.now()}-${id}${path.extname(file.originalname).toLowerCase()}`);
    },
  });
}

const soloImagenes = (req, file, cb) => {
  const ok = /image\/(jpe?g|png|webp)/.test(file.mimetype);
  cb(ok ? null : new Error('Solo se permiten imagenes JPG, PNG o WEBP'), ok);
};

const limite = { fileSize: 4 * 1024 * 1024 }; // 4 MB por archivo

export const subirFotosChalet = multer({
  storage: almacenamiento('chalets'),
  fileFilter: soloImagenes,
  limits: limite,
});

export const subirComprobante = multer({
  storage: almacenamiento('comprobantes'),
  fileFilter: soloImagenes,
  limits: limite,
});

// Recorta las capturas del móvil para la ficha de Play.
//
// Play exige que el lado largo no pase del doble del corto; el móvil da
// 1220x2712 (2,22:1), que se rechazaría. Quitando la barra de estado y la de
// navegación —que además Play recomienda no incluir— queda 1220x2440, o sea
// 2:1 exacto.
//
// Node puro: decodifica el PNG (RGBA de 8 bits sin entrelazar, que es lo que
// produce `adb screencap`), recorta y vuelve a codificar. Sin dependencias.

const fs = require('fs');
const zlib = require('zlib');

// ── CRC32 (el que exige la especificación PNG para cada chunk) ──
const TABLA_CRC = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function leerPNG(ruta) {
    const b = fs.readFileSync(ruta);
    const ancho = b.readUInt32BE(16), alto = b.readUInt32BE(20);
    if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0)
        throw new Error('solo se admite RGBA de 8 bits sin entrelazar');

    const trozos = [];
    let o = 8;
    while (o < b.length) {
        const len = b.readUInt32BE(o);
        if (b.slice(o + 4, o + 8).toString() === 'IDAT') trozos.push(b.slice(o + 8, o + 8 + len));
        o += 12 + len;
    }

    const bruto = zlib.inflateSync(Buffer.concat(trozos));
    const bpp = 4, linea = ancho * bpp;
    const px = Buffer.alloc(alto * linea);

    // Deshace el filtro de cada scanline (PNG guarda el tipo en el primer byte)
    for (let y = 0; y < alto; y++) {
        const filtro = bruto[y * (linea + 1)];
        const ent = bruto.slice(y * (linea + 1) + 1, y * (linea + 1) + 1 + linea);
        const sal = px.slice(y * linea, (y + 1) * linea);
        const arriba = y > 0 ? px.slice((y - 1) * linea, y * linea) : null;

        for (let i = 0; i < linea; i++) {
            const a = i >= bpp ? sal[i - bpp] : 0;
            const b2 = arriba ? arriba[i] : 0;
            const c = (arriba && i >= bpp) ? arriba[i - bpp] : 0;
            let v = ent[i];
            if (filtro === 1) v += a;
            else if (filtro === 2) v += b2;
            else if (filtro === 3) v += (a + b2) >> 1;
            else if (filtro === 4) {
                const p = a + b2 - c, pa = Math.abs(p - a), pb = Math.abs(p - b2), pc = Math.abs(p - c);
                v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b2 : c);
            }
            sal[i] = v & 0xFF;
        }
    }
    return { ancho, alto, px };
}

function escribirPNG(ruta, ancho, alto, px) {
    const linea = ancho * 4;
    const bruto = Buffer.alloc(alto * (linea + 1));
    for (let y = 0; y < alto; y++) {
        bruto[y * (linea + 1)] = 0; // filtro None: el deflate ya comprime de sobra
        px.copy(bruto, y * (linea + 1) + 1, y * linea, (y + 1) * linea);
    }

    const chunk = (tipo, datos) => {
        const c = Buffer.alloc(8 + datos.length + 4);
        c.writeUInt32BE(datos.length, 0);
        c.write(tipo, 4);
        datos.copy(c, 8);
        c.writeUInt32BE(crc32(c.slice(4, 8 + datos.length)), 8 + datos.length);
        return c;
    };

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(ancho, 0);
    ihdr.writeUInt32BE(alto, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

    fs.writeFileSync(ruta, Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(bruto, { level: 9 })),
        chunk('IEND', Buffer.alloc(0))
    ]));
}

function recorta(origen, destino, x, y, w, h) {
    const img = leerPNG(origen);
    if (x + w > img.ancho || y + h > img.alto)
        throw new Error(`recorte fuera de la imagen (${img.ancho}x${img.alto})`);
    const sal = Buffer.alloc(w * h * 4);
    for (let fila = 0; fila < h; fila++)
        img.px.copy(sal, fila * w * 4, ((y + fila) * img.ancho + x) * 4, ((y + fila) * img.ancho + x + w) * 4);
    escribirPNG(destino, w, h, sal);
    return { w, h, bytes: fs.statSync(destino).size };
}

if (require.main === module) {
    const [origen, destino, x, y, w, h] = process.argv.slice(2);
    const r = recorta(origen, destino, +x, +y, +w, +h);
    console.log(`${destino}  ${r.w}x${r.h}  ${(r.bytes / 1024).toFixed(0)} KB  ratio ${(r.h / r.w).toFixed(3)}:1`);
}

module.exports = { recorta };

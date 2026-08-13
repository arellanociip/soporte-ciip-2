/* ---------- La Hoja de Servicio ----------
   El documento del Excel, rehecho en HTML. Es lo que sale por la impresora
   desde la bandeja y lo que se convierte en PDF para quien pidió el soporte.

   Vive aquí, en un solo sitio, porque son el mismo papel: si la bandeja
   imprimiera una cosa y el PDF otra, en el archivo de la gerencia acabaría
   habiendo dos versiones del mismo número de hoja.
   Prefijo: hoja. */
(function(){
  'use strict';

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const RENGLONES = 6;   /* la tabla del Excel siempre tuvo seis filas */

  /* s: la solicitud.  tec: quién firma como técnico —en la bandeja es quien
     está atendiendo ahora mismo, aunque todavía no se haya guardado; en el PDF
     es lo que quedó guardado—.  obs: lo mismo con las observaciones. */
  function hojaServicioHtml(s, tec, obs){
    tec = tec || {};
    const f = new Date(s.atendida_en || s.creada_en || Date.now());
    const renglones = Array.isArray(s.renglones) ? s.renglones : [];

    const filas = Array.from({length: RENGLONES}, (_, i) => {
      const r = renglones[i] || {};
      return `<tr>
        <td style="text-align:center">${i+1}</td>
        <td>${esc(r.tipo||'')}</td><td>${esc(r.detalle||'')}</td>
        <td>${esc(r.equipo||'')}</td><td>${esc(r.marca||'')}</td>
        <td>${esc(r.modelo||'')}</td><td>${esc(r.serial||'')}</td>
      </tr>`;
    }).join('');

    const raya = v => v ? esc(v) : '<span class="lin"></span>';

    return `<div class="hs">
      <div class="hs-cab">
        <img src="assets/logo_ciip_navy.png" alt="CIIP">
        <div class="hs-n">N° GTIC-HS/<b>${String(s.numero).padStart(3,'0')}-${esc(String(s.anio))}</b>
          <div>${String(f.getDate()).padStart(2,'0')}/${String(f.getMonth()+1).padStart(2,'0')}/${f.getFullYear()}</div>
        </div>
      </div>

      <h1>HOJA DE SERVICIO</h1>

      <table>
        <tr><th colspan="6">GERENCIA SOLICITANTE:</th></tr>
        <tr><td colspan="6" style="text-align:center; font-weight:bold">${esc(s.gerencia)}</td></tr>
        <tr>
          <th>USUARIO:</th><th>C.I.</th><th>TELEF.</th><th>PISO:</th><th colspan="2">OFICINA:</th>
        </tr>
        <tr>
          <td>${esc(s.usuario)}</td><td>${esc(s.cedula||'S/N')}</td><td>${esc(s.telefono||'S/N')}</td>
          <td style="text-align:center">${esc(s.piso)}</td><td colspan="2" style="text-align:center">${esc(s.oficina)}</td>
        </tr>
      </table>

      <div class="hs-titulo">RESUMEN DE LA SOLICITUD</div>
      <div class="hs-titulo" style="border-top:none">DESCRIPCION DE LA SITUACION PLANTEADA POR EL USUARIO</div>
      <div class="hs-caja">${esc(s.descripcion)}</div>

      <table>
        <tr>
          <th style="width:4%">ITEM</th><th style="width:14%">TIPO DE SERVICIO</th>
          <th style="width:32%">DETALLE DE SERVICIO</th><th style="width:12%">EQUIPO</th>
          <th style="width:10%">MARCA</th><th style="width:12%">MODELO</th><th style="width:16%">SERIAL</th>
        </tr>
        ${filas}
      </table>

      <div class="hs-titulo">OBSERVACIONES:</div>
      <div class="hs-caja">${esc(obs !== undefined ? obs : (s.observaciones || ''))}</div>

      <div class="hs-nota">LA PRESENTE DEJA CONSTANCIA Y CONFORMIDAD DE LA ATENCION PRESTADA POR LA
      GERENCIA DE TECNOLOGIA DE LA INFORMACION Y COMUNICACIÓN.</div>

      <div class="hs-firmas">
        <div class="hs-bloque">
          <div class="hs-fh">DATOS DEL USUARIO</div>
          <div class="hs-fila">
            <div class="hs-fb">
              NOMBRE Y APELLIDO: ${esc(s.usuario)}<br>
              C.I. N°.: ${esc(s.cedula||'S/N')}<br>
              TELEFONO: ${esc(s.telefono||'S/N')}<br>
              CARGO: ${raya(s.cargo)}<br>
              FIRMA: <span class="lin"></span>
            </div>
            <div class="hs-sello">SELLO</div>
          </div>
        </div>
        <div class="hs-bloque">
          <div class="hs-fh">TECNICO DE SOPORTE</div>
          <div class="hs-fila">
            <div class="hs-fb">
              NOMBRE Y APELLIDO: ${esc(tec.nombre || '')}<br>
              C.I. N°.: ${raya(tec.cedula)}<br>
              TELEFONO: ${raya(tec.telefono)}<br>
              CARGO: ${raya(tec.cargo)}<br>
              FIRMA: <span class="lin"></span>
            </div>
            <div class="hs-sello">SELLO</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  window.hojaServicioHtml = hojaServicioHtml;
})();

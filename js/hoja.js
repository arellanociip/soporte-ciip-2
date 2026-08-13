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

 /* En el renglón, el tipo se guarda con la clave del catálogo —SOPORTE_TECNICO—
    porque es lo que casa con el desplegable de la ficha. En el papel eso no se
    escribe así: un documento no lleva palabras en mayúscula con guion bajo. */
  const TIPOS_HOJA = {SOPORTE_TECNICO: 'Soporte técnico', ASISTENCIA: 'Asistencia'};
  const comoSeEscribe = t => TIPOS_HOJA[String(t || '').trim().toUpperCase()] || t || '';

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
        <td>${esc(comoSeEscribe(r.tipo))}</td><td>${esc(r.detalle||'')}</td>
        <td>${esc(r.equipo||'')}</td><td>${esc(r.marca||'')}</td>
        <td>${esc(r.modelo||'')}</td><td>${esc(r.serial||'')}</td>
      </tr>`;
    }).join('');

    /* Cada dato sobre su raya, esté lleno o vacío. En el papel del Excel las
       rayas están siempre: son las que dicen dónde escribir lo que falte y las
       que hacen que la hoja se lea como un formulario y no como una lista.
       Antes solo salía la raya cuando el dato faltaba, y el bloque quedaba
       cojo —unos renglones subrayados y otros no—. */
    const renglon = (rotulo, valor) =>
      `<div class="hs-r"><span class="et">${esc(rotulo)}</span>` +
      `<span class="va">${esc(valor || '')}</span></div>`;

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
          <th>USUARIO:</th><th>C.I.</th><th>TELÉF.</th><th>PISO:</th><th colspan="2">OFICINA:</th>
        </tr>
        <tr>
          <td>${esc(s.usuario)}</td><td>${esc(s.cedula||'S/N')}</td><td>${esc(s.telefono||'S/N')}</td>
          <td style="text-align:center">${esc(s.piso)}</td><td colspan="2" style="text-align:center">${esc(s.oficina)}</td>
        </tr>
      </table>

      <div class="hs-titulo">RESUMEN DE LA SOLICITUD</div>
      <div class="hs-titulo" style="border-top:none">DESCRIPCIÓN DE LA SITUACIÓN PLANTEADA POR EL USUARIO</div>
      <div class="hs-caja">${esc(s.descripcion)}</div>

      <table>
        <tr>
          <th style="width:4%">ÍTEM</th><th style="width:14%">TIPO DE SERVICIO</th>
          <th style="width:32%">DETALLE DE SERVICIO</th><th style="width:12%">EQUIPO</th>
          <th style="width:10%">MARCA</th><th style="width:12%">MODELO</th><th style="width:16%">SERIAL</th>
        </tr>
        ${filas}
      </table>

      <div class="hs-titulo">OBSERVACIONES:</div>
      <div class="hs-caja">${esc(obs !== undefined ? obs : (s.observaciones || ''))}</div>

      <div class="hs-nota">LA PRESENTE DEJA CONSTANCIA Y CONFORMIDAD DE LA ATENCIÓN PRESTADA POR LA
      GERENCIA DE TECNOLOGÍA DE LA INFORMACIÓN Y COMUNICACIÓN.</div>

      <div class="hs-firmas">
        <div class="hs-bloque">
          <div class="hs-fh">DATOS DEL USUARIO</div>
          <div class="hs-fb">
            ${renglon('NOMBRE Y APELLIDO:', s.usuario)}
            ${renglon('C.I. N°:', s.cedula)}
            ${renglon('TELÉFONO:', s.telefono)}
            ${renglon('CARGO:', s.cargo)}
          </div>
        </div>
        <div class="hs-bloque">
          <div class="hs-fh">TÉCNICO DE SOPORTE</div>
          <div class="hs-fb">
            ${renglon('NOMBRE Y APELLIDO:', tec.nombre)}
            ${renglon('C.I. N°:', tec.cedula)}
            ${renglon('TELÉFONO:', tec.telefono)}
            ${renglon('CARGO:', tec.cargo)}
          </div>
        </div>
      </div>
    </div>`;
  }

  window.hojaServicioHtml = hojaServicioHtml;
})();

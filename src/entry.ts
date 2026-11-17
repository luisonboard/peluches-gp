// Punto de entrada: `?mando=ABCD` abre el teléfono como mando (sin el juego 3D); lo demás, el juego.
if (new URLSearchParams(location.search).has('mando')) void import('./pad/phone');
else void import('./main');

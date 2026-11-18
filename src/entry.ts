// Punto de entrada: `?mando=ABCD` abre el teléfono como mando (sin el juego 3D); lo demás, el juego.
// Con el archivo único (vite-plugin-singlefile) todos los módulos se cargan juntos, así que cada uno exporta su
// función de arranque y aquí se llama solo a la que toca.
import { startGame } from './main';
import { startPhone } from './pad/phone';

if (new URLSearchParams(location.search).has('mando')) startPhone();
else startGame();

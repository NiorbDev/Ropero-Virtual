import { useSyncExternalStore } from "react";

export type UiLanguage = "es" | "en" | "pt";
const messages: Record<string, [string, string]> = {
  "Privacidad y uso de datos": ["Privacy and data use", "Privacidade e uso de dados"],
  "Guardado en tu dispositivo": ["Saved on your device", "Salvo no seu dispositivo"],
  "Tus perfiles, prendas, fotos, conjuntos y preferencias se guardan en este dispositivo o navegador. Ropero Virtual no requiere una cuenta ni sincroniza tu ropero con un servidor.": ["Your profiles, garments, photos, outfits and preferences are saved on this device or browser. Ropero Virtual requires no account and does not sync your wardrobe to a server.", "Seus perfis, peças, fotos, looks e preferências ficam salvos neste dispositivo ou navegador. O Ropero Virtual não exige conta nem sincroniza seu guarda-roupa com um servidor."],
  "Fotos, cámara y recorte": ["Photos, camera and cutouts", "Fotos, câmera e recorte"],
  "La cámara se usa cuando la abres para tomar una foto. El recorte automático puede necesitar internet para descargar el modelo. Tus fotos se procesan en el dispositivo y no se envían al proveedor del modelo.": ["The camera is used when you open it to take a photo. Automatic cutouts may need internet access to download the model. Your photos are processed on your device and are not sent to the model provider.", "A câmera é usada quando você a abre para tirar uma foto. O recorte automático pode precisar de internet para baixar o modelo. Suas fotos são processadas no dispositivo e não são enviadas ao fornecedor do modelo."],
  "Copias y control de tus datos": ["Backups and data control", "Cópias e controle dos seus dados"],
  "Puedes exportar una copia del ropero con sus fotos y conjuntos. Si la compartes, quien reciba el archivo podrá acceder a su contenido. Borrar los datos de la app o del sitio elimina la copia local. Exporta primero si quieres conservarla.": ["You can export a copy of your wardrobe with its photos and outfits. Anyone you share the file with can access its contents. Clearing app or site data removes the local copy. Export it first if you want to keep it.", "Você pode exportar uma cópia do guarda-roupa com fotos e looks. Quem receber o arquivo poderá acessar seu conteúdo. Limpar os dados do app ou do site remove a cópia local. Exporte primeiro se quiser mantê-la."],
  "Enlaces externos": ["External links", "Links externos"],
  "Los enlaces de contacto y créditos abren servicios externos. Esos servicios aplican sus propias políticas de privacidad.": ["Contact and credit links open external services. Those services have their own privacy policies.", "Os links de contato e créditos abrem serviços externos. Esses serviços têm suas próprias políticas de privacidade."],
  "Crear accesorio": ["Create accessory", "Criar acessório"],
  "Agregar accesorio": ["Add accessory", "Adicionar acessório"],
  "Tipo de accesorio": ["Accessory type", "Tipo de acessório"],
  "Agrega accesorios de esta categoría para combinarlos aquí.": ["Add accessories in this category to combine them here.", "Adicione acessórios desta categoria para combiná-los aqui."],
  "Música de fondo": ["Background music", "Música de fundo"],
  "Reproducir música": ["Play music", "Reproduzir música"],
  "Pausar música": ["Pause music", "Pausar música"],
  "No se pudo reproducir la música. Intenta de nuevo.": ["Music could not play. Try again.", "Não foi possível reproduzir a música. Tente novamente."],
  "Volumen reducido y archivo comprimido.": ["Volume reduced and file compressed.", "Volume reduzido e arquivo comprimido."],
  "Escribir por WhatsApp": ["Message on WhatsApp", "Enviar mensagem pelo WhatsApp"],
  "Talla": ["Size","Tamanho"],
  "Temporadas": ["Seasons","Estações"],
  "Estilos": ["Styles","Estilos"],
  "Todas": ["All","Todas"],
  "Secciones del ropero": ["Wardrobe sections","Seções do guarda-roupa"],
  "PERFIL ACTIVO": ["ACTIVE PROFILE","PERFIL ATIVO"],
  "TU ESPACIO DE ESTILO": ["YOUR STYLE SPACE","SEU ESPAÇO DE ESTILO"],
  "Probador de conjuntos 2D": ["2D outfit fitting room","Provador de looks 2D"],
  "Ej: Salida del sábado": ["e.g. Saturday outing","Ex.: passeio de sábado"],
  "Salida del sábado": ["Saturday outing","Passeio de sábado"],
  "Ej. Chaqueta beige": ["e.g. Beige jacket","Ex.: jaqueta bege"],
  "Negro, lila": ["Black, lilac","Preto, lilás"],
  "Invierno, otoño": ["Winter, fall","Inverno, outono"],
  "Largo (cm opcional)": ["Length (optional, cm)","Comprimento (cm, opcional)"],
  "Ancho (cm opcional)": ["Width (optional, cm)","Largura (cm, opcional)"],
  "Manga (cm opcional)": ["Sleeve (optional, cm)","Manga (cm, opcional)"],
  "Largo en cm": ["Length in cm","Comprimento em cm"],
  "Ancho en cm": ["Width in cm","Largura em cm"],
  "Manga en cm": ["Sleeve in cm","Manga em cm"],
  "Borra solo el fondo. Tu foto original siempre queda guardada.": ["Erase the background. Your original photo is kept.","Apague o fundo. Sua foto original é preservada."],
  "Acércate a los bordes con un pincel pequeño para conservar todos los detalles de la prenda.": ["Use a small brush near edges to preserve details.","Use um pincel pequeno nas bordas para preservar os detalhes."],
  "Modo del pincel": ["Brush mode","Modo do pincel"],
  "Exportando…": ["Exporting…","Exportando…"],
  "Revisando…": ["Checking…","Verificando…"],
  "Importando…": ["Importing…","Importando…"],
  "Ropero exportado con sus fotos y conjuntos.": ["Wardrobe exported with photos and outfits.","Guarda-roupa exportado com fotos e looks."],
  "Transferir ropero": ["Transfer wardrobe","Transferir guarda-roupa"],
  "Probar conjunto": ["Try outfit","Provar look"],
  "Editar": ["Edit","Editar"],
  "Paso": ["Step","Etapa"],
  "de": ["of","de"],
  "Recortando…": ["Removing background…","Removendo fundo…"],
  "seleccionadas": ["selected","selecionadas"],
  "Quitar foto": ["Remove photo","Remover foto"],
  "No pude abrir la cámara. Revisa el permiso o usa una foto de la galería.": ["Could not open the camera. Check permissions or use a gallery photo.","Não foi possível abrir a câmera. Verifique a permissão ou escolha uma foto da galeria."],
  "Con el nombre basta para guardarla. Puedes usar la foto con su fondo; quitarlo es opcional.": ["Only a name is required. Removing the photo background is optional.","Só o nome é obrigatório. Remover o fundo da foto é opcional."],
  "Tus perfiles tendrán roperos separados y guardados solo en este equipo.": ["Your wardrobe is stored on this device.","Seu guarda-roupa é salvo neste dispositivo."],
  "Instalar app": ["Install app","Instalar aplicativo"],
  "Actualizar ahora": ["Update now","Atualizar agora"],
  "Arma tu conjunto": [
    "Build your outfit",
    "Monte seu look"
  ],
  "TU MIX DE HOY": [
    "TODAY'S LOOK",
    "LOOK DE HOJE"
  ],
  "Una fila por tipo de prenda. Cambia con las flechas, sin arrastrar.": [
    "One row per clothing type. Use the arrows to switch items.",
    "Uma linha por tipo de peça. Use as setas para trocar as peças."
  ],
  "Nuevo conjunto": [
    "New outfit",
    "Novo look"
  ],
  "CONJUNTO ACTUAL": [
    "CURRENT OUTFIT",
    "LOOK ATUAL"
  ],
  "Partes de arriba": [
    "Tops",
    "Partes de cima"
  ],
  "Partes de abajo": [
    "Bottoms",
    "Partes de baixo"
  ],
  "Vestidos y faldas": [
    "Dresses and skirts",
    "Vestidos e saias"
  ],
  "Abrigos": [
    "Outerwear",
    "Casacos"
  ],
  "Calzado": [
    "Footwear",
    "Calçados"
  ],
  "Accesorios": [
    "Accessories",
    "Acessórios"
  ],
  "Sin prenda · usa las flechas para elegir": [
    "No item · use the arrows to choose",
    "Sem peça · use as setas para escolher"
  ],
  "Agrega prendas a tu ropero para verlas aquí": [
    "Add clothes to your wardrobe to see them here",
    "Adicione peças ao guarda-roupa para vê-las aqui"
  ],
  "Combinar varios accesorios": [
    "Combine accessories",
    "Combinar acessórios"
  ],
  "Mi nuevo conjunto": [
    "My new outfit",
    "Meu novo look"
  ],
  "Nombre del conjunto": [
    "Outfit name",
    "Nome do look"
  ],
  "Guardar conjunto": [
    "Save outfit",
    "Salvar look"
  ],
  "Conjunto guardado.": [
    "Outfit saved.",
    "Look salvo."
  ],
  "Solo se guarda al pulsar Guardar. Cambiar de conjunto descarta esta vista previa.": [
    "Tap Save to keep this outfit. Switching outfits discards this preview.",
    "Toque em Salvar para manter este look. Trocar de look descarta esta prévia."
  ],
  "Conjunto anterior": [
    "Previous outfit",
    "Look anterior"
  ],
  "Conjunto siguiente": [
    "Next outfit",
    "Próximo look"
  ],
  "Sin foto": [
    "No photo",
    "Sem foto"
  ],
  "Deshacer": [
    "Undo",
    "Desfazer"
  ],
  "Rehacer": [
    "Redo",
    "Refazer"
  ],
  "Ayuda": [
    "Help",
    "Ajuda"
  ],
  "Omitir": [
    "Skip",
    "Pular"
  ],
  "Anterior": [
    "Back",
    "Anterior"
  ],
  "Siguiente": [
    "Next",
    "Próximo"
  ],
  "Cerrar tutorial": [
    "Close tutorial",
    "Fechar tutorial"
  ],
  "Bienvenida a tu ropero": [
    "Welcome to your wardrobe",
    "Boas-vindas ao seu guarda-roupa"
  ],
  "Mi ropero": [
    "My wardrobe",
    "Meu guarda-roupa"
  ],
  "Tus conjuntos": [
    "Your outfits",
    "Seus looks"
  ],
  "En Probador 2D puedes combinar prendas con las flechas de cada fila.": [
    "Use the arrows in each row to combine clothes in the 2D fitting room.",
    "Use as setas de cada linha para combinar peças no provador 2D."
  ],
  "Aquí agregas prendas y las buscas por nombre, color o descripción. Puedes tomar una foto desde la app o elegir una de tu galería.": [
    "Add clothes here and search by name, color or description. Take a photo or choose one from your gallery.",
    "Adicione peças aqui e busque por nome, cor ou descrição. Tire uma foto ou escolha uma da galeria."
  ],
  "Cada corazón cambia la prenda de su fila. Dale un nombre a tu combinación y pulsa Guardar conjunto.": [
    "Each heart switches the item in its row. Name your outfit and tap Save outfit.",
    "Cada coração troca a peça da linha. Dê um nome ao look e toque em Salvar look."
  ],
  "Aquí están tus combinaciones guardadas. Usa Probar conjunto para llevar una al probador.": [
    "Your saved outfits appear here. Tap Try outfit to open one in the fitting room.",
    "Seus looks salvos aparecem aqui. Toque em Provar look para abrir um no provador."
  ],
  "Añadir mi primera prenda": [
    "Add my first item",
    "Adicionar minha primeira peça"
  ],
  "Ir al probador": [
    "Go to fitting room",
    "Ir ao provador"
  ],
  "¿Qué quieres vestir hoy?": [
    "What will you wear today?",
    "O que você vai vestir hoje?"
  ],
  "Tu ropero completo": [
    "Your wardrobe",
    "Seu guarda-roupa"
  ],
  "Tus conjuntos favoritos": [
    "Your favorite outfits",
    "Seus looks favoritos"
  ],
  "Guardado en este equipo ✓": [
    "Saved on this device ✓",
    "Salvo neste dispositivo ✓"
  ],
  "Guardado local listo": [
    "Local storage ready",
    "Armazenamento local pronto"
  ],
  "Preparando almacenamiento seguro…": [
    "Preparing storage…",
    "Preparando armazenamento…"
  ],
  "HOLA,": [
    "HELLO,",
    "OLÁ,"
  ],
  "Tu nombre": [
    "Your name",
    "Seu nome"
  ],
  "Crear mi ropero": [
    "Create my wardrobe",
    "Criar meu guarda-roupa"
  ],
  "Organiza tus prendas y arma conjuntos con lo que ya tienes.": [
    "Organize your clothes and create outfits with what you own.",
    "Organize suas peças e monte looks com o que você já tem."
  ],
  "＋ Agregar prenda": [
    "＋ Add clothing",
    "＋ Adicionar peça"
  ],
  "Buscar prendas": [
    "Search clothes",
    "Buscar peças"
  ],
  "Categoría": [
    "Category",
    "Categoria"
  ],
  "Filtrar categoría": [
    "Filter by category",
    "Filtrar categoria"
  ],
  "Filtrar disponibilidad": [
    "Filter by availability",
    "Filtrar disponibilidade"
  ],
  "Nombre, color o descripción": [
    "Name, color or description",
    "Nome, cor ou descrição"
  ],
  "Limpiar filtros": [
    "Clear filters",
    "Limpar filtros"
  ],
  "Nueva prenda": [
    "New item",
    "Nova peça"
  ],
  "Nombre de la prenda": [
    "Item name",
    "Nome da peça"
  ],
  "Nombre": [
    "Name",
    "Nome"
  ],
  "Tipo de prenda": [
    "Clothing type",
    "Tipo de peça"
  ],
  "Tipo": [
    "Type",
    "Tipo"
  ],
  "Color": [
    "Color",
    "Cor"
  ],
  "Cómo te queda": [
    "Fit",
    "Caimento"
  ],
  "Entallada": [
    "Fitted",
    "Justa"
  ],
  "Regular": [
    "Regular",
    "Regular"
  ],
  "Holgada": [
    "Loose",
    "Folgado"
  ],
  "Holgada / oversized": [
    "Loose / oversized",
    "Folgado / oversized"
  ],
  "Descripción": [
    "Description",
    "Descrição"
  ],
  "Más detalles": [
    "More details",
    "Mais detalhes"
  ],
  "Disponibilidad": [
    "Availability",
    "Disponibilidade"
  ],
  "Disponible": [
    "Available",
    "Disponível"
  ],
  "Prestada": [
    "Borrowed",
    "Emprestada"
  ],
  "Prestada / de otra persona": [
    "Borrowed / belongs to someone else",
    "Emprestada / de outra pessoa"
  ],
  "No recomendar": [
    "Exclude from suggestions",
    "Não recomendar"
  ],
  "Largo aproximado": [
    "Approximate length",
    "Comprimento aproximado"
  ],
  "Ancho aproximado": [
    "Approximate width",
    "Largura aproximada"
  ],
  "Mangas aproximadas": [
    "Sleeve length",
    "Comprimento das mangas"
  ],
  "Corto": [
    "Short",
    "Curto"
  ],
  "Largo": [
    "Long",
    "Longo"
  ],
  "Estrecho": [
    "Narrow",
    "Estreito"
  ],
  "Ancho": [
    "Wide",
    "Largo"
  ],
  "Sin mangas": [
    "Sleeveless",
    "Sem mangas"
  ],
  "Guardar prenda": [
    "Save item",
    "Salvar peça"
  ],
  "Guardar cambios": [
    "Save changes",
    "Salvar alterações"
  ],
  "Cancelar": [
    "Cancel",
    "Cancelar"
  ],
  "Mi colección": [
    "My collection",
    "Minha coleção"
  ],
  "Prendas archivadas": [
    "Archived items",
    "Peças arquivadas"
  ],
  "Ver prendas archivadas": [
    "Show archived items",
    "Ver peças arquivadas"
  ],
  "No tienes prendas archivadas": [
    "No archived items",
    "Você não tem peças arquivadas"
  ],
  "Tu ropero está esperando": [
    "Your wardrobe is waiting",
    "Seu guarda-roupa está esperando"
  ],
  "Agregar mi primera prenda": [
    "Add my first item",
    "Adicionar minha primeira peça"
  ],
  "No encontramos prendas con esos filtros": [
    "No items match those filters",
    "Nenhuma peça corresponde aos filtros"
  ],
  "Sin color indicado": [
    "No color specified",
    "Cor não informada"
  ],
  "Crear un conjunto": [
    "Create an outfit",
    "Criar um look"
  ],
  "Prendas": [
    "Clothes",
    "Peças"
  ],
  "Buscar y filtrar prendas": [
    "Search and filter clothes",
    "Buscar e filtrar peças"
  ],
  "Buscar prendas para el conjunto": [
    "Search clothes for the outfit",
    "Buscar peças para o look"
  ],
  "Nombre, tipo o color": [
    "Name, type or color",
    "Nome, tipo ou cor"
  ],
  "Categoría de prenda": [
    "Clothing category",
    "Categoria da peça"
  ],
  "Todas las categorías": [
    "All categories",
    "Todas as categorias"
  ],
  "No hay prendas que coincidan.": [
    "No matching items.",
    "Nenhuma peça encontrada."
  ],
  "Agrega prendas en Mi ropero para combinarlas.": [
    "Add clothes to My wardrobe to combine them.",
    "Adicione peças em Meu guarda-roupa para combiná-las."
  ],
  "Ver conjuntos archivados": [
    "Show archived outfits",
    "Ver looks arquivados"
  ],
  "Vista previa del conjunto": [
    "Outfit preview",
    "Prévia do look"
  ],
  "Prenda no disponible": [
    "Item unavailable",
    "Peça indisponível"
  ],
  "CONJUNTO": [
    "OUTFIT",
    "LOOK"
  ],
  "Contacto y sugerencias": [
    "Contact and feedback",
    "Contato e sugestões"
  ],
  "Envíame tus dudas, ideas o errores que encuentres en Ropero Virtual.": [
    "Send me your questions, ideas or bugs you find in Ropero Virtual.",
    "Envie suas dúvidas, ideias ou problemas encontrados no Ropero Virtual."
  ],
  "Fotos de la prenda": [
    "Item photos",
    "Fotos da peça"
  ],
  "Opcional · puedes agregarlas después": [
    "Optional · you can add them later",
    "Opcional · você pode adicioná-las depois"
  ],
  "Usar cámara": [
    "Use camera",
    "Usar câmera"
  ],
  "Elegir de la galería": [
    "Choose from gallery",
    "Escolher da galeria"
  ],
  "Vista previa de la cámara": [
    "Camera preview",
    "Prévia da câmera"
  ],
  "Tomar foto": [
    "Take photo",
    "Tirar foto"
  ],
  "Cerrar cámara": [
    "Close camera",
    "Fechar câmera"
  ],
  "Ajustar recorte": [
    "Adjust cutout",
    "Ajustar recorte"
  ],
  "Quitar fondo automáticamente": [
    "Remove background automatically",
    "Remover fundo automaticamente"
  ],
  "Rehacer recorte automático": [
    "Redo automatic cutout",
    "Refazer recorte automático"
  ],
  "Quitar fondo a todas las fotos pendientes": [
    "Remove background from remaining photos",
    "Remover fundo das fotos restantes"
  ],
  "Recortando fotos…": [
    "Processing photos…",
    "Processando fotos…"
  ],
  "Usar foto con fondo": [
    "Use original background",
    "Usar fundo original"
  ],
  "Buscar opciones": [
    "Search options",
    "Buscar opções"
  ],
  "No encontramos opciones.": [
    "No options found.",
    "Nenhuma opção encontrada."
  ],
  "Cerrar selector": [
    "Close picker",
    "Fechar seletor"
  ],
  "Elegir": [
    "Choose",
    "Escolher"
  ],
  "RESPALDO Y TRASPASO": [
    "BACKUP AND TRANSFER",
    "BACKUP E TRANSFERÊNCIA"
  ],
  "Lleva tu ropero contigo": [
    "Take your wardrobe with you",
    "Leve seu guarda-roupa com você"
  ],
  "Copia automática de Android": [
    "Android automatic backup",
    "Backup automático do Android"
  ],
  "Exportar ropero": [
    "Export wardrobe",
    "Exportar guarda-roupa"
  ],
  "Importar ropero": [
    "Import wardrobe",
    "Importar guarda-roupa"
  ],
  "Archivo .ropero": [
    ".ropero file",
    "Arquivo .ropero"
  ],
  "ARCHIVO REVISADO": [
    "FILE CHECKED",
    "ARQUIVO VERIFICADO"
  ],
  "Confirmar importación": [
    "Confirm import",
    "Confirmar importação"
  ],
  "Ropero importado correctamente.": [
    "Wardrobe imported.",
    "Guarda-roupa importado."
  ],
  "Las prendas y conjuntos del archivo se añadirán a tu ropero.": [
    "The file's clothes and outfits will be added to your wardrobe.",
    "As peças e os looks do arquivo serão adicionados ao seu guarda-roupa."
  ],
  "Exporta tus prendas, conjuntos y fotos en un archivo .ropero. Puedes guardarlo en Google Drive y volver a importarlo desde otro equipo.": [
    "Export clothes, outfits and photos to a .ropero file. Save it to Google Drive to import it on another device.",
    "Exporte peças, looks e fotos em um arquivo .ropero. Salve-o no Google Drive para importar em outro dispositivo."
  ],
  "Activa la copia de seguridad en los ajustes de Android. El sistema decide cuándo copiar los datos y si puede restaurarlos. Si tu ropero tiene muchas fotos, guarda también un archivo .ropero: la copia en la nube de Android tiene un límite de 25 MB por app.": [
    "Enable backup in Android settings. Android manages backup and restore. Keep a .ropero file if you have many photos: Android cloud backup is limited to 25 MB per app.",
    "Ative o backup nas configurações do Android. O sistema gerencia a cópia e a restauração. Guarde também um arquivo .ropero se tiver muitas fotos: o backup na nuvem tem limite de 25 MB por app."
  ],
  "AJUSTE DE FOTO": [
    "PHOTO EDITOR",
    "EDITOR DE FOTO"
  ],
  "Cerrar editor": [
    "Close editor",
    "Fechar editor"
  ],
  "Preparando la foto…": [
    "Preparing photo…",
    "Preparando foto…"
  ],
  "Vista previa del recorte": [
    "Cutout preview",
    "Prévia do recorte"
  ],
  "Borrar fondo": [
    "Erase background",
    "Apagar fundo"
  ],
  "Restaurar fondo": [
    "Restore background",
    "Restaurar fundo"
  ],
  "Tamaño del pincel": [
    "Brush size",
    "Tamanho do pincel"
  ],
  "Restablecer recorte": [
    "Reset cutout",
    "Redefinir recorte"
  ],
  "Usar foto completa": [
    "Use full photo",
    "Usar foto inteira"
  ],
  "Guardar recorte": [
    "Save cutout",
    "Salvar recorte"
  ],
  "Archivar": [
    "Archive",
    "Arquivar"
  ],
  "Restaurar": [
    "Restore",
    "Restaurar"
  ],
  "Eliminar": [
    "Delete",
    "Excluir"
  ],
  "Sí, eliminar": [
    "Yes, delete",
    "Sim, excluir"
  ],
  "Polera": [
    "T-shirt",
    "Camiseta"
  ],
  "Polera manga corta": [
    "Short-sleeve T-shirt",
    "Camiseta de manga curta"
  ],
  "Polera manga larga": [
    "Long-sleeve T-shirt",
    "Camiseta de manga longa"
  ],
  "Polera sin mangas": [
    "Sleeveless shirt",
    "Camiseta sem mangas"
  ],
  "Polera musculosa": [
    "Tank top",
    "Regata"
  ],
  "Polera con cuello": [
    "Collared shirt",
    "Camiseta com gola"
  ],
  "Polera deportiva": [
    "Sports shirt",
    "Camiseta esportiva"
  ],
  "Beatle / cuello alto": [
    "Turtleneck",
    "Gola alta"
  ],
  "Camisa": [
    "Shirt",
    "Camisa"
  ],
  "Chaleco": [
    "Cardigan",
    "Cardigã"
  ],
  "Pantalón": [
    "Trousers",
    "Calça"
  ],
  "Pantalón cargo": [
    "Cargo trousers",
    "Calça cargo"
  ],
  "Pantalón de traje": [
    "Suit trousers",
    "Calça social"
  ],
  "Chaquetas y abrigos": [
    "Jackets and coats",
    "Jaquetas e casacos"
  ],
  "Chaqueta de cuero": [
    "Leather jacket",
    "Jaqueta de couro"
  ],
  "Chaqueta de mezclilla": [
    "Denim jacket",
    "Jaqueta jeans"
  ]
};
let language: UiLanguage = "es";
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setUiLanguage(value: UiLanguage) {
  document.documentElement.lang = value;
  if (value === language) return;
  language = value;
  listeners.forEach((listener) => listener());
}
export function useUiText() {
  const current = useSyncExternalStore(subscribe, () => language);
  return (text: string) => current === "es" ? text : messages[text]?.[current === "en" ? 0 : 1] ?? text;
}

# 🎙️ DubDT - Estúdio de Dublagem & Fandub

O **DubDT** é uma estação de dublagem (ADR) desktop moderna feita especialmente para dubladores, criadores de conteúdo e fandubbers.

Desenvolvido com **Electron + React + Vite + TypeScript + Tailwind CSS + Wavesurfer.js** integrado diretamente com o **FFmpeg** nativo.

---

## 🚀 Como Iniciar

No terminal, dentro da pasta `Z:\DubDT`:

```bash
# Para iniciar o aplicativo de produção:
npm start

# Ou para iniciar em modo de desenvolvimento com Hot Reload:
npm run dev
```

---

## 🛠️ Fluxo de Trabalho (Passo a Passo)

### 1. Timestamps & Waveform (Anotação de Falas)
* Clique em **"Selecionar Vídeo"** para carregar seu arquivo (`.mp4`, `.mkv`, `.webm`, `.mov`, `.avi`).
* O DubDT extrai a waveform do áudio em segundo plano com o FFmpeg para carregamento instantâneo.
* **Segure a tecla `CTRL`** e arraste o mouse sobre a waveform para selecionar exatamente o trecho em que o personagem fala.
* Digite a fala (ex: *"Estou pronto!"*) e pressione <kbd>ENTER</kbd>.
* O bloco de fala ficará salvo na lista com início, fim e duração. Você pode clicar no bloco para ir até ele no vídeo, arrastar suas bordas para ajuste fino, ou editar o texto.
* Ao terminar, clique em **"Avançar para Gravação ➔"**.

### 2. Estúdio de Gravação (Studio Mode)
* O vídeo fica automaticamente travado no timestamp da fala selecionada.
* **Teleprompter em letras grandes:** A fala atual é exibida em destaque para facilitar a atuação.
* **Pressione <kbd>R</kbd>** (ou clique em *"Gravar Fala"*):
  * **Contagem de 3 Segundos:** Um contador visual na tela com **bipes sonoros (3... 2... 1... GO!)** prepara você no ritmo.
  * O vídeo roda a cena e o microfone grava a sua voz com ganho calibrado.
* **Múltiplos Takes:** Se quiser regravar, pressione <kbd>R</kbd> novamente. Ele salva como `Take #1`, `Take #2`, etc. Você pode ouvir cada um deles individualmente e escolher qual é o "Oficial".
* **Navegação rápida por teclado:**
  * <kbd>R</kbd>: Gravar / Parar gravação
  * <kbd>Espaço</kbd>: Ouvir trecho original do vídeo
  * <kbd>→</kbd> (Seta Direita): Próxima fala
  * <kbd>←</kbd> (Seta Esquerda): Fala anterior
* **Controles na tela:** Ajuste o volume do áudio original durante a gravação para não cobrir seus fones, e regule o ganho do microfone.

### 3. Central de Mixagem & Exportação
* **Mixer de 3 Canais:**
  * 🎙️ **Vozes Dubladas:** Ajuste de volume das suas gravações e seletor de **Presets Rápidos de Efeito na Voz**:
    * *Natural / Clean:* Sem filtros adicionais.
    * *Normalizador:* Volume uniforme no padrão broadcast (EBU R128).
    * *Rádio / Telefone:* Filtro passa-alta e passa-baixa para simular ligações ou comunicadores.
    * *Eco / Pensamento:* Reverberação suave para cenas de lembrança ou monólogo interno.
  * 🎬 **Áudio Original do Vídeo:** Ative ou desative (mute) e controle o volume.
  * 🎵 **Áudio Sem Falas (M&E / Upload Customizado):** Carregue um instrumental/fundo limpo sem vozes para dublagens profissionais.
* **Opções de Exportação:**
  * 🎬 **Exportar Vídeo Completo:** Renderiza o `.mp4` com a imagem original e as novas vozes mixadas com o fundo.
  * 🎵 **Exportar Áudio Completo:** Salva apenas a mixagem sonora em `.wav` ou `.mp3`.
  * ✂️ **Exportar Timestamps Separadamente:** Corta e exporta cada fala individualmente como vídeo (`.mp4`) ou áudio (`.wav`), com ou sem o som de fundo.
  * 📜 **Exportar Roteiro (.txt):** Gera um arquivo de texto com todos os timestamps e falas formatados.

### ⚙️ Configurações de Áudio
* Clique no botão **"Áudio"** no topo para:
  * Escolher o dispositivo de entrada (Microfone).
  * Escolher o dispositivo de saída (Fones de ouvido / Caixas).
  * Testar a sensibilidade do microfone com VU Meter em tempo real.
  * Configurar o Pré-Roll (ex: o vídeo começar 1.5s antes da fala para pegar o ritmo).
  * Ligar ou desligar os bipes sonoros de contagem.

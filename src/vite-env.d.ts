/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 공공데이터포털 KorService2 서비스 키 (.env.local 또는 CI Secret 으로 주입) */
  readonly VITE_KORSERVICE2_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

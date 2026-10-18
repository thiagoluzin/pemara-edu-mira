!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao PEMARA EDU"
  !define MUI_WELCOMEPAGE_TEXT "Crie e organize suas aulas com IA, Atlas, projetos e conversas em uma única janela.$\r$\n$\r$\nAs ferramentas estão incluídas. Nenhum terminal ou download de dependências é necessário durante a instalação.$\r$\n$\r$\nA geração usa o modelo configurado no OpenCode e requer acesso ao provedor. O modelo gratuito foi recusado no teste; escolha um modelo disponível para gerar. Aulas salvas, Atlas e HTML funcionam offline.$\r$\n$\r$\nClique em Avançar para continuar."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInstall
  ; Electron's restricted GPU/network processes need read/execute access to
  ; their own installation. Only this program folder receives the permission;
  ; profile, documents and Windows parent directories are never modified.
  nsExec::ExecToStack '"$SYSDIR\icacls.exe" "$INSTDIR" /grant "*S-1-15-2-2:(OI)(CI)(RX)"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "Não foi possível preparar a leitura dos arquivos do aplicativo. A instalação não foi concluída. Código: $0"
    Abort
  ${EndIf}
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TEXT "Este assistente remove somente o aplicativo PEMARA EDU.$\r$\n$\r$\nSuas aulas em Documentos\PEMARA Aulas e suas conversas em AppData\Local\PEMARAOpenChamber serão preservadas."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

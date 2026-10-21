!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "PEMARA EDU — Teste Limpo"
  !define MUI_WELCOMEPAGE_TEXT "Esta edição começa sem aulas, pesquisas ou conversas anteriores.$\r$\n$\r$\nEla usa um atalho, uma instalação e um perfil próprios. Sua instalação anterior e seus dados continuam disponíveis.$\r$\n$\r$\nProfessores especialistas, habilidades e Atlas estão incluídos. A geração por IA precisa de internet e da disponibilidade dos modelos gratuitos.$\r$\n$\r$\nReinstalar esta mesma edição preserva os dados criados nela."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInstall
  nsExec::ExecToStack '"$SYSDIR\icacls.exe" "$INSTDIR" /grant "*S-1-15-2-2:(OI)(CI)(RX)"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "Não foi possível preparar a leitura do aplicativo. Código: $0"
    Abort
  ${EndIf}
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TEXT "Remove somente o PEMARA EDU Teste Limpo.$\r$\n$\r$\nSeus dados desta edição em Documentos\PEMARA Aulas - Teste Limpo e AppData\Local\PEMARAEduTesteLimpo serão preservados. A instalação anterior não será modificada."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

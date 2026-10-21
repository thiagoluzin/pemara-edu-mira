param([Parameter(Mandatory=$true)][string]$DocumentPath,[Parameter(Mandatory=$true)][string]$PdfPath,[string]$EditedPath)
$ErrorActionPreference='Stop'
$taskWord=$null
$taskDocument=$null
try {
 $taskWord=New-Object -ComObject Word.Application
 $taskWord.Visible=$false
 $taskWord.DisplayAlerts=0
 $taskDocument=$taskWord.Documents.Open($DocumentPath,$false,$true)
 $taskText=$taskDocument.Content.Text
 if($taskText.Length -lt 500){throw 'Word não reconheceu o texto editável da aula'}
 $taskDocument.ExportAsFixedFormat($PdfPath,17)
 $taskResult=@{openedInMicrosoftWord=$true;characters=$taskText.Length;pages=$taskDocument.ComputeStatistics(2);tables=$taskDocument.Tables.Count;figures=$taskDocument.InlineShapes.Count;pdf=$PdfPath}
 if($EditedPath){
  if(Test-Path -LiteralPath $EditedPath){throw 'A cópia de edição de teste já existe'}
  $taskOriginalHash=(Get-FileHash -LiteralPath $DocumentPath).Hash
  $taskDocument.Range(0,0).InsertBefore('Edição de teste confirmada no Word'+[char]13)
  $taskDocument.SaveAs2($EditedPath,16)
  $taskDocument.Close(0)
  [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskDocument)
  $taskDocument=$taskWord.Documents.Open($EditedPath,$false,$true)
  if(-not $taskDocument.Content.Text.StartsWith('Edição de teste confirmada no Word')){throw 'Edição não persistiu'}
  if((Get-FileHash -LiteralPath $DocumentPath).Hash -ne $taskOriginalHash){throw 'O Word modificou o documento original'}
  $taskResult.editAndReopenPassed=$true
 }
 $taskResult|ConvertTo-Json
} finally {
 if($null -ne $taskDocument){$taskDocument.Close(0);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskDocument)}
 if($null -ne $taskWord){$taskWord.Quit();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskWord)}
}

import React, { useState } from 'react';
import { Info, X, FileText, Download } from 'lucide-react';

interface SkippedRow {
  lineNumber: number;
  rowContent: any[];
  reason: string;
  category: 'cabeçalho' | 'rodapé' | 'vazia' | 'inválida' | 'metadado';
}

interface SkippedRowsNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  skippedRows: SkippedRow[];
  fileName: string;
  stats: {
    totalRows: number;
    processed: number;
    skippedEmpty: number;
    skippedHeaderFooter: number;
    invalid: number;
  };
}

export const SkippedRowsNotification: React.FC<SkippedRowsNotificationProps> = ({
  isOpen,
  onClose,
  skippedRows,
  fileName,
  stats
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Calcular resumo por categoria
  const categorySummary = React.useMemo(() => {
    const summary = {
      'cabeçalho': skippedRows.filter(r => r.category === 'cabeçalho').length,
      'rodapé': skippedRows.filter(r => r.category === 'rodapé').length,
      'vazia': skippedRows.filter(r => r.category === 'vazia').length,
      'inválida': skippedRows.filter(r => r.category === 'inválida').length
    };
    return summary;
  }, [skippedRows]);

  if (!isOpen) return null;

  const totalSkipped = skippedRows.length;

  const generateSkippedRowsReport = () => {
    let report = `RELATÓRIO DE LINHAS IGNORADAS NA IMPORTAÇÃO\n`;
    report += `Arquivo: ${fileName}\n`;
    report += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
    report += `\n${'='.repeat(80)}\n\n`;
    
    report += `RESUMO:\n`;
    report += `${'-'.repeat(80)}\n`;
    report += `Total de linhas na planilha: ${stats.totalRows + 1}\n`;
    report += `Linhas processadas com sucesso: ${stats.processed}\n`;
    report += `Linhas ignoradas: ${totalSkipped}\n`;
    report += `  - Cabeçalhos duplicados: ${categorySummary.cabeçalho}\n`;
    report += `  - Rodapés: ${categorySummary.rodapé}\n`;
    report += `  - Linhas vazias: ${categorySummary.vazia}\n`;
    report += `  - Linhas inválidas: ${categorySummary.inválida}\n`;
    report += `\n${'='.repeat(80)}\n\n`;
    
    // Agrupar por categoria
    const byCategory = {
      'cabeçalho': skippedRows.filter(r => r.category === 'cabeçalho'),
      'rodapé': skippedRows.filter(r => r.category === 'rodapé'),
      'vazia': skippedRows.filter(r => r.category === 'vazia'),
      'inválida': skippedRows.filter(r => r.category === 'inválida')
    };
    
    // Cabeçalhos
    if (byCategory.cabeçalho.length > 0) {
      report += `CABEÇALHOS DUPLICADOS (${byCategory.cabeçalho.length})\n`;
      report += `${'-'.repeat(80)}\n\n`;
      byCategory.cabeçalho.forEach((row, index) => {
        report += `${index + 1}. Linha ${row.lineNumber}:\n`;
        report += `   Motivo: ${row.reason}\n`;
        report += `   Conteúdo: ${row.rowContent.map(cell => String(cell || '(vazio)')).join(' | ')}\n`;
        report += `\n`;
      });
      report += `${'='.repeat(80)}\n\n`;
    }
    
    // Rodapés
    if (byCategory.rodapé.length > 0) {
      report += `RODAPÉS (${byCategory.rodapé.length})\n`;
      report += `${'-'.repeat(80)}\n\n`;
      byCategory.rodapé.forEach((row, index) => {
        report += `${index + 1}. Linha ${row.lineNumber}:\n`;
        report += `   Motivo: ${row.reason}\n`;
        report += `   Conteúdo: ${row.rowContent.map(cell => String(cell || '(vazio)')).join(' | ')}\n`;
        report += `\n`;
      });
      report += `${'='.repeat(80)}\n\n`;
    }
    
    // Linhas vazias
    if (byCategory.vazia.length > 0) {
      report += `LINHAS VAZIAS (${byCategory.vazia.length})\n`;
      report += `${'-'.repeat(80)}\n\n`;
      byCategory.vazia.forEach((row, index) => {
        report += `${index + 1}. Linha ${row.lineNumber}:\n`;
        report += `   Motivo: ${row.reason}\n`;
        report += `   Conteúdo: ${row.rowContent.map(cell => String(cell || '(vazio)')).join(' | ')}\n`;
        report += `\n`;
      });
      report += `${'='.repeat(80)}\n\n`;
    }
    
    // Linhas inválidas
    if (byCategory.inválida.length > 0) {
      report += `LINHAS INVÁLIDAS (${byCategory.inválida.length})\n`;
      report += `${'-'.repeat(80)}\n\n`;
      byCategory.inválida.forEach((row, index) => {
        report += `${index + 1}. Linha ${row.lineNumber}:\n`;
        report += `   Motivo: ${row.reason}\n`;
        report += `   Conteúdo da linha:\n`;
        row.rowContent.forEach((cell, cellIndex) => {
          report += `     Coluna ${cellIndex + 1}: ${cell || '(vazio)'}\n`;
        });
        report += `\n${'-'.repeat(80)}\n\n`;
      });
    }
    
    return report;
  };

  const downloadAsText = () => {
    const report = generateSkippedRowsReport();
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `linhas_ignoradas_${fileName.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const printAsPDF = () => {
    const report = generateSkippedRowsReport();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório de Linhas Ignoradas - ${fileName}</title>
          <style>
            @media print {
              @page {
                margin: 2cm;
              }
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 10pt;
              line-height: 1.4;
              margin: 20px;
              color: #000;
            }
            h1 {
              font-size: 16pt;
              font-weight: bold;
              margin-bottom: 10px;
            }
            h2 {
              font-size: 12pt;
              font-weight: bold;
              margin-top: 20px;
              margin-bottom: 10px;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            .header {
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>RELATÓRIO DE LINHAS IGNORADAS NA IMPORTAÇÃO</h1>
            <p><strong>Arquivo:</strong> ${fileName}</p>
            <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          <pre>${report}</pre>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Criar mensagem resumida
  const summaryMessages: string[] = [];
  if (categorySummary.cabeçalho > 0) {
    summaryMessages.push(`${categorySummary.cabeçalho} ${categorySummary.cabeçalho === 1 ? 'linha de cabeçalho' : 'linhas de cabeçalho'}`);
  }
  if (categorySummary.rodapé > 0) {
    summaryMessages.push(`${categorySummary.rodapé} ${categorySummary.rodapé === 1 ? 'linha de rodapé' : 'linhas de rodapé'}`);
  }
  if (categorySummary.vazia > 0) {
    summaryMessages.push(`${categorySummary.vazia} ${categorySummary.vazia === 1 ? 'linha vazia' : 'linhas vazias'}`);
  }
  if (categorySummary.inválida > 0) {
    summaryMessages.push(`${categorySummary.inválida} ${categorySummary.inválida === 1 ? 'linha inválida' : 'linhas inválidas'}`);
  }

  const summaryText = summaryMessages.length > 0 
    ? summaryMessages.join(', ')
    : `${totalSkipped} ${totalSkipped === 1 ? 'linha ignorada' : 'linhas ignoradas'}`;

  return (
    <>
      {/* Notificação Toast */}
      <div className="fixed top-4 right-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg shadow-lg z-50 max-w-md">
        <div className="p-4">
          <div className="flex items-start">
            <Info className="w-6 h-6 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-800 mb-1">
                Linhas Ignoradas na Importação
              </h3>
              <p className="text-sm text-blue-700 mb-3">
                {summaryText} foram ignoradas durante a importação.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDetails(true)}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <FileText className="w-4 h-4" />
                  Baixar Relatório
                </button>
                <button
                  onClick={onClose}
                  className="text-blue-500 hover:text-blue-700 transition-colors ml-auto"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Detalhes */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center">
                <Info className="w-6 h-6 text-blue-500 mr-2" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Detalhes das Linhas Ignoradas - {fileName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={printAsPDF}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                  title="Imprimir/Salvar como PDF"
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </button>
                <button
                  onClick={downloadAsText}
                  className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  TXT
                </button>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {/* Resumo */}
              <div className="mb-6">
                <h4 className="text-md font-semibold text-blue-700 mb-3">
                  Resumo
                </h4>
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <ul className="list-disc list-inside space-y-1">
                    <li className="text-sm text-gray-700">
                      <strong>Total de linhas na planilha:</strong> {stats.totalRows + 1}
                    </li>
                    <li className="text-sm text-gray-700">
                      <strong>Linhas processadas com sucesso:</strong> {stats.processed}
                    </li>
                    <li className="text-sm text-gray-700">
                      <strong>Linhas ignoradas:</strong> {totalSkipped}
                    </li>
                    {categorySummary.cabeçalho > 0 && (
                      <li className="text-sm text-gray-700">
                        <strong>Cabeçalhos duplicados:</strong> {categorySummary.cabeçalho}
                      </li>
                    )}
                    {categorySummary.rodapé > 0 && (
                      <li className="text-sm text-gray-700">
                        <strong>Rodapés:</strong> {categorySummary.rodapé}
                      </li>
                    )}
                    {categorySummary.vazia > 0 && (
                      <li className="text-sm text-gray-700">
                        <strong>Linhas vazias:</strong> {categorySummary.vazia}
                      </li>
                    )}
                    {categorySummary.inválida > 0 && (
                      <li className="text-sm text-gray-700">
                        <strong>Linhas inválidas:</strong> {categorySummary.inválida}
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Detalhes por categoria */}
              <div className="space-y-4">
                {skippedRows.map((row, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded p-4">
                    <div className="font-semibold text-gray-800 mb-2">
                      Linha {row.lineNumber} - {row.category.charAt(0).toUpperCase() + row.category.slice(1)}
                    </div>
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-700 mb-1">Motivo:</div>
                      <div className="text-sm text-gray-600">{row.reason}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Conteúdo da linha:</div>
                      <div className="bg-white border border-gray-200 rounded p-2 text-xs font-mono overflow-x-auto">
                        {row.rowContent.map((cell, cellIndex) => (
                          <div key={cellIndex} className="mb-1">
                            <span className="text-gray-500">Coluna {cellIndex + 1}:</span>{' '}
                            <span className="text-gray-800">{cell || '(vazio)'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

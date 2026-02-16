import React, { useState } from 'react';
import { AlertCircle, X, FileText, Download } from 'lucide-react';

interface InvalidRow {
  lineNumber: number;
  rowContent: any[];
  errors: string[];
}

interface ImportErrorNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  invalidRows: InvalidRow[];
  invalidBusinessUnits: string[];
  fileName: string;
}

export const ImportErrorNotification: React.FC<ImportErrorNotificationProps> = ({
  isOpen,
  onClose,
  invalidRows,
  invalidBusinessUnits,
  fileName
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Calcular resumo de erros por tipo
  // IMPORTANTE: Todos os hooks devem ser chamados ANTES de qualquer return condicional
  const errorSummary = React.useMemo(() => {
    const summary: { [key: string]: number } = {};
    
    invalidRows.forEach(row => {
      row.errors.forEach(error => {
        // Normalizar mensagens de erro para agrupar
        let errorType = error;
        if (error.includes('Data Pagamento')) {
          errorType = 'Data Pagamento inválida';
        } else if (error.includes('Data de Vencimento')) {
          errorType = 'Data de Vencimento inválida';
        } else if (error.includes('Credor')) {
          errorType = 'Credor inválido';
        } else if (error.includes('Valor')) {
          errorType = 'Valor inválido';
        } else if (error.includes('Status')) {
          errorType = 'Status inválido';
        } else if (error.includes('Unidade de Negócio')) {
          errorType = 'Unidade de Negócio inválida';
        } else if (error.includes('Plano de Contas')) {
          errorType = 'Plano de Contas inválido';
        }
        
        summary[errorType] = (summary[errorType] || 0) + 1;
      });
    });
    
    return summary;
  }, [invalidRows]);

  if (!isOpen) return null;

  const totalErrors = invalidRows.length + invalidBusinessUnits.length;

  const generateErrorReport = () => {
    let report = `RELATÓRIO DE ERROS DE IMPORTAÇÃO\n`;
    report += `Arquivo: ${fileName}\n`;
    report += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
    report += `\n${'='.repeat(80)}\n\n`;

    if (invalidBusinessUnits.length > 0) {
      report += `UNIDADES DE NEGÓCIO INVÁLIDAS (${invalidBusinessUnits.length})\n`;
      report += `${'-'.repeat(80)}\n`;
      invalidBusinessUnits.forEach((unit, index) => {
        report += `${index + 1}. Unidade: ${unit}\n`;
      });
      report += `\n${'='.repeat(80)}\n\n`;
    }

    if (invalidRows.length > 0) {
      report += `LINHAS INVÁLIDAS (${invalidRows.length})\n`;
      report += `${'-'.repeat(80)}\n\n`;
      
      // Adicionar resumo de erros
      if (Object.keys(errorSummary).length > 0) {
        report += `RESUMO DOS ERROS:\n`;
        report += `${'-'.repeat(80)}\n`;
        Object.entries(errorSummary)
          .sort((a, b) => b[1] - a[1])
          .forEach(([errorType, count]) => {
            report += `  • ${count} ${count === 1 ? 'linha' : 'linhas'} com ${errorType.toLowerCase()}\n`;
          });
        report += `\n${'='.repeat(80)}\n\n`;
      }
      
      invalidRows.forEach((row, index) => {
        report += `Linha ${row.lineNumber}:\n`;
        report += `  Erros encontrados:\n`;
        row.errors.forEach((error, errIndex) => {
          report += `    ${errIndex + 1}. ${error}\n`;
        });
        report += `  Conteúdo da linha:\n`;
        row.rowContent.forEach((cell, cellIndex) => {
          report += `    Coluna ${cellIndex + 1}: ${cell || '(vazio)'}\n`;
        });
        report += `\n${'-'.repeat(80)}\n\n`;
      });
    }

    return report;
  };

  const downloadAsText = () => {
    const report = generateErrorReport();
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `erros_importacao_${fileName.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const printAsPDF = () => {
    const report = generateErrorReport();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório de Erros - ${fileName}</title>
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
            <h1>RELATÓRIO DE ERROS DE IMPORTAÇÃO</h1>
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

  return (
    <>
      {/* Notificação Toast */}
      <div className="fixed top-4 right-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-lg z-50 max-w-md">
        <div className="p-4">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800 mb-1">
                Erros na Importação
              </h3>
              <p className="text-sm text-red-700 mb-3">
                {totalErrors > 0 
                  ? `Foram encontrados ${totalErrors} erro(s) na planilha.`
                  : 'Erro ao processar a planilha.'
                }
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDetails(true)}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-1"
                >
                  <FileText className="w-4 h-4" />
                  Consultar Erros
                </button>
                <button
                  onClick={downloadAsText}
                  className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  Baixar TXT
                </button>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 transition-colors ml-auto"
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
                <AlertCircle className="w-6 h-6 text-red-500 mr-2" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Detalhes dos Erros - {fileName}
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
              {invalidBusinessUnits.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-red-700 mb-3">
                    Unidades de Negócio Inválidas ({invalidBusinessUnits.length})
                  </h4>
                  <div className="bg-red-50 border border-red-200 rounded p-4">
                    <ul className="list-disc list-inside space-y-1">
                      {invalidBusinessUnits.map((unit, index) => (
                        <li key={index} className="text-sm text-gray-700">
                          <strong>Unidade:</strong> {unit}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-sm text-gray-600">
                      Por favor, cadastre essas empresas antes de continuar a importação.
                    </p>
                  </div>
                </div>
              )}

              {invalidRows.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold text-red-700 mb-3">
                    Linhas Inválidas ({invalidRows.length})
                  </h4>
                  
                  {/* Resumo de erros por tipo */}
                  {Object.keys(errorSummary).length > 0 && (
                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-4">
                      <h5 className="text-sm font-semibold text-blue-800 mb-2">
                        Resumo dos Erros:
                      </h5>
                      <ul className="list-disc list-inside space-y-1">
                        {Object.entries(errorSummary)
                          .sort((a, b) => b[1] - a[1]) // Ordenar por quantidade (maior primeiro)
                          .map(([errorType, count], index) => (
                            <li key={index} className="text-sm text-gray-700">
                              <strong>{count}</strong> {count === 1 ? 'linha' : 'linhas'} com <strong>{errorType.toLowerCase()}</strong>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-4">
                    {invalidRows.map((row, index) => (
                      <div key={index} className="bg-red-50 border border-red-200 rounded p-4">
                        <div className="font-semibold text-red-800 mb-2">
                          Linha {row.lineNumber}
                        </div>
                        <div className="mb-3">
                          <div className="text-sm font-medium text-gray-700 mb-1">Erros:</div>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            {row.errors.map((error, errIndex) => (
                              <li key={errIndex} className="text-sm text-gray-700">
                                {error}
                              </li>
                            ))}
                          </ul>
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
              )}
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

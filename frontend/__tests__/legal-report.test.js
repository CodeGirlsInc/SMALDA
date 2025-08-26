import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LegalReportPage from '../app/legal-report/page';
import PdfExportButton from '../components/ui/PdfExportButton';

// Mock jsPDF
jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    setFontSize: jest.fn(),
    setFont: jest.fn(),
    setTextColor: jest.fn(),
    text: jest.fn(),
    addPage: jest.fn(),
    getNumberOfPages: jest.fn().mockReturnValue(1),
    setPage: jest.fn(),
    save: jest.fn(),
    splitTextToSize: jest.fn().mockReturnValue(['Mock text']),
    internal: {
      pageSize: {
        getWidth: jest.fn().mockReturnValue(595),
        getHeight: jest.fn().mockReturnValue(842)
      }
    }
  }));
});

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }) => {
    return <a href={href}>{children}</a>;
  };
});

describe('Legal Report Export Page', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('Page Rendering', () => {
    test('renders the main page title', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('Legal Analysis Report')).toBeInTheDocument();
    });

    test('renders the page description', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('Comprehensive analysis of uploaded land documents')).toBeInTheDocument();
    });

    test('renders back to dashboard button', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
    });

    test('renders export PDF button', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('Export as PDF')).toBeInTheDocument();
    });
  });

  describe('Document Information Section', () => {
    test('renders document information card', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('Document Information')).toBeInTheDocument();
    });

    test('displays document title', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('Land Ownership Certificate - Plot No. 1234')).toBeInTheDocument();
    });

    test('displays document type', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('Land Ownership Certificate')).toBeInTheDocument();
    });

    test('displays document number', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('LOC-2024-001234')).toBeInTheDocument();
    });

    test('displays upload date', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    });

    test('displays file size', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('2.4 MB')).toBeInTheDocument();
    });
  });

  describe('Analysis Summary Section', () => {
    test('renders analysis summary card', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('Analysis Summary')).toBeInTheDocument();
    });

    test('displays overall risk level', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('LOW')).toBeInTheDocument();
    });

    test('displays confidence percentage', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('94%')).toBeInTheDocument();
    });

    test('displays processing time', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('2.3 seconds')).toBeInTheDocument();
    });

    test('displays AI model version', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('SMALDA v2.1')).toBeInTheDocument();
    });
  });

  describe('Property Details Section', () => {
    test('renders property details card', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('Property Details')).toBeInTheDocument();
    });

    test('displays property location', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('District: Central, City: Metropolis')).toBeInTheDocument();
    });

    test('displays property area', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('1,250 square meters')).toBeInTheDocument();
    });

    test('displays zoning information', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('Residential')).toBeInTheDocument();
    });

    test('displays assessed value', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('$450,000')).toBeInTheDocument();
    });
  });

  describe('Detailed Findings Section', () => {
    test('renders detailed findings card', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('Detailed Findings')).toBeInTheDocument();
    });

    test('displays verification finding', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('VERIFICATION')).toBeInTheDocument();
      expect(screen.getByText('Document authenticity verified through blockchain verification')).toBeInTheDocument();
    });

    test('displays ownership finding', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('OWNERSHIP')).toBeInTheDocument();
      expect(screen.getByText('Clear chain of ownership established')).toBeInTheDocument();
    });

    test('displays boundaries finding', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('BOUNDARIES')).toBeInTheDocument();
      expect(screen.getByText('Minor boundary discrepancy detected')).toBeInTheDocument();
    });

    test('displays encumbrances finding', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('ENCUMBRANCES')).toBeInTheDocument();
      expect(screen.getByText('No active encumbrances found')).toBeInTheDocument();
    });

    test('displays compliance finding', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('COMPLIANCE')).toBeInTheDocument();
      expect(screen.getByText('All regulatory requirements met')).toBeInTheDocument();
    });
  });

  describe('Recommendations Section', () => {
    test('renders recommendations card', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('Recommendations')).toBeInTheDocument();
    });

    test('displays all recommendations', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('Schedule professional survey to resolve boundary discrepancy')).toBeInTheDocument();
      expect(screen.getByText('Maintain regular monitoring for any new encumbrances')).toBeInTheDocument();
      expect(screen.getByText('Consider title insurance for additional protection')).toBeInTheDocument();
      expect(screen.getByText('Keep digital copies of all related documents')).toBeInTheDocument();
    });
  });

  describe('Risk Level Indicators', () => {
    test('displays correct risk level colors', () => {
      render(<LegalReportPage />);
      
      // Check for LOW risk indicators (green)
      const lowRiskElements = screen.getAllByText('LOW RISK');
      lowRiskElements.forEach(element => {
        expect(element).toHaveClass('text-green-600', 'bg-green-50');
      });

      // Check for MEDIUM risk indicators (yellow)
      const mediumRiskElements = screen.getAllByText('MEDIUM RISK');
      mediumRiskElements.forEach(element => {
        expect(element).toHaveClass('text-yellow-600', 'bg-yellow-50');
      });
    });
  });

  describe('Status Icons', () => {
    test('displays correct status icons', () => {
      render(<LegalReportPage />);
      
      // Check for PASSED status icons (check circle)
      const passedElements = screen.getAllByText('PASSED');
      passedElements.forEach(element => {
        const icon = element.closest('div').querySelector('svg');
        expect(icon).toBeInTheDocument();
      });

      // Check for WARNING status icons (alert triangle)
      const warningElements = screen.getAllByText('WARNING');
      warningElements.forEach(element => {
        const icon = element.closest('div').querySelector('svg');
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe('Footer Information', () => {
    test('renders footer with generation timestamp', () => {
      render(<LegalReportPage />);
      expect(screen.getByText(/This report was generated by SMALDA AI on/)).toBeInTheDocument();
    });

    test('renders support contact information', () => {
      render(<LegalReportPage />);
      expect(screen.getByText('For questions or support, please contact our legal team.')).toBeInTheDocument();
    });
  });
});

describe('PdfExportButton Component', () => {
  const mockData = {
    documentInfo: {
      title: 'Test Document',
      documentType: 'Test Type',
      documentNumber: 'TEST-001'
    },
    findings: [
      {
        type: 'TEST',
        status: 'PASSED',
        description: 'Test finding'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders export button with default text', () => {
      render(<PdfExportButton data={mockData} />);
      expect(screen.getByText('Export as PDF')).toBeInTheDocument();
    });

    test('renders export button with custom text', () => {
      render(<PdfExportButton data={mockData} title="Custom Export" />);
      expect(screen.getByText('Custom Export')).toBeInTheDocument();
    });

    test('renders download icon', () => {
      render(<PdfExportButton data={mockData} />);
      const icon = screen.getByRole('button').querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    test('button is enabled by default', () => {
      render(<PdfExportButton data={mockData} />);
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    test('button shows loading state when exporting', async () => {
      render(<PdfExportButton data={mockData} />);
      const button = screen.getByRole('button');
      
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('Generating PDF...')).toBeInTheDocument();
      });
    });

    test('button is disabled during export', async () => {
      render(<PdfExportButton data={mockData} />);
      const button = screen.getByRole('button');
      
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('PDF Generation', () => {
    test('calls jsPDF constructor when button is clicked', async () => {
      const jsPDF = require('jspdf');
      render(<PdfExportButton data={mockData} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(jsPDF).toHaveBeenCalled();
      });
    });

    test('generates PDF with correct filename', async () => {
      const jsPDF = require('jspdf');
      const mockSave = jest.fn();
      jsPDF.mockImplementation(() => ({
        setFontSize: jest.fn(),
        setFont: jest.fn(),
        setTextColor: jest.fn(),
        text: jest.fn(),
        addPage: jest.fn(),
        getNumberOfPages: jest.fn().mockReturnValue(1),
        setPage: jest.fn(),
        save: mockSave,
        splitTextToSize: jest.fn().mockReturnValue(['Mock text']),
        internal: {
          pageSize: {
            getWidth: jest.fn().mockReturnValue(595),
            getHeight: jest.fn().mockReturnValue(842)
          }
        }
      }));

      render(<PdfExportButton data={mockData} filename="test-report.pdf" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledWith('test-report.pdf');
      });
    });

    test('handles PDF generation errors gracefully', async () => {
      const jsPDF = require('jspdf');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      jsPDF.mockImplementation(() => {
        throw new Error('PDF generation failed');
      });

      render(<PdfExportButton data={mockData} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error generating PDF:', expect.any(Error));
        expect(alertSpy).toHaveBeenCalledWith('Error generating PDF. Please try again.');
      });

      consoleSpy.mockRestore();
      alertSpy.mockRestore();
    });
  });

  describe('Data Handling', () => {
    test('handles empty data gracefully', async () => {
      const jsPDF = require('jspdf');
      render(<PdfExportButton data={{}} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(jsPDF).toHaveBeenCalled();
      });
    });

    test('handles null data gracefully', async () => {
      const jsPDF = require('jspdf');
      render(<PdfExportButton data={null} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(jsPDF).toHaveBeenCalled();
      });
    });

    test('handles legal report data structure', async () => {
      const jsPDF = require('jspdf');
      const legalReportData = {
        documentInfo: {
          title: 'Legal Document',
          documentType: 'Certificate',
          documentNumber: 'LEGAL-001'
        },
        findings: [
          {
            type: 'VERIFICATION',
            status: 'PASSED',
            description: 'Document verified'
          }
        ]
      };

      render(<PdfExportButton data={legalReportData} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(jsPDF).toHaveBeenCalled();
      });
    });
  });

  describe('Component Props', () => {
    test('applies custom className', () => {
      render(<PdfExportButton data={mockData} className="custom-class" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    test('applies custom variant', () => {
      render(<PdfExportButton data={mockData} variant="outline" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('border', 'bg-background');
    });

    test('applies custom size', () => {
      render(<PdfExportButton data={mockData} size="lg" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-10', 'px-6');
    });
  });
});

describe('Integration Tests', () => {
  test('complete user flow from page load to PDF export', async () => {
    render(<LegalReportPage />);
    
    // Verify page loads with all sections
    expect(screen.getByText('Legal Analysis Report')).toBeInTheDocument();
    expect(screen.getByText('Document Information')).toBeInTheDocument();
    expect(screen.getByText('Analysis Summary')).toBeInTheDocument();
    expect(screen.getByText('Property Details')).toBeInTheDocument();
    expect(screen.getByText('Detailed Findings')).toBeInTheDocument();
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    
    // Verify export button is present and functional
    const exportButton = screen.getByText('Export as PDF');
    expect(exportButton).toBeInTheDocument();
    
    // Test PDF export functionality
    fireEvent.click(exportButton);
    
    await waitFor(() => {
      expect(screen.getByText('Generating PDF...')).toBeInTheDocument();
    });
  });

  test('navigation links work correctly', () => {
    render(<LegalReportPage />);
    
    const backButton = screen.getByText('Back to Dashboard');
    expect(backButton).toBeInTheDocument();
    expect(backButton.closest('a')).toHaveAttribute('href', '/');
  });
});

// Mock window.alert for testing
global.alert = jest.fn();

// Cleanup after all tests
afterAll(() => {
  jest.restoreAllMocks();
}); 
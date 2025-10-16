import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadScript } from 'lightning/platformResourceLoader';
import getEmailTemplateBody from '@salesforce/apex/EmailTemplateController.getEmailTemplateBody';
import JSPDF from '@salesforce/resourceUrl/jspdf';

export default class BillingPDFGenerator extends LightningElement {
    @api recordId;
    templateName = 'AIA702';
    fileName = '';
    @track isLoading = false;
    @track errorMessage = '';
    @track htmlContent = '';

    jsPDFInitialized = false;

    connectedCallback() {
        this.loadLibraries();
        this.loadTemplateContent();
    }

    /**
     * Load external JavaScript library (jsPDF)
     */
    async loadLibraries() {
        try {
            // Load jsPDF
            await loadScript(this, JSPDF);
            this.jsPDFInitialized = true;
            console.log('jsPDF loaded successfully');

        } catch (error) {
            this.errorMessage = 'Error loading PDF library: ' + error.message;
            console.error('Error loading library:', error);
        }
    }

    /**
     * Load email template content from Apex
     */
    async loadTemplateContent() {
        if (!this.templateName) {
            this.errorMessage = 'No template name provided';
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        try {
            const result = await getEmailTemplateBody({
                templateName: this.templateName,
                recordId: this.recordId
            });

            const htmlBody = result?.body;
            this.fileName = result?.billingName || 'template.pdf';

            this.htmlContent = htmlBody || '<div>No content available</div>';
            this.renderPreview(this.htmlContent);

        } catch (error) {
            this.errorMessage = 'Error loading template: ' + (error.body?.message || error.message);
            console.error('Error loading template:', error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Render HTML preview in the container
     */
    renderPreview(htmlContent) {
        const previewContainer = this.template.querySelector('.preview-content');
        if (previewContainer) {
            previewContainer.innerHTML = htmlContent;
        }
    }

    /**
     * Handle Download PDF button click
     */
    async handleDownloadPDF() {
        if (!this.jsPDFInitialized) {
            this.showToast('Error', 'PDF library is still loading. Please try again.', 'error');
            return;
        }

        this.isLoading = true;

        try {
            const previewContainer = this.template.querySelector('.preview-content');

            if (!previewContainer || !previewContainer.innerHTML) {
                throw new Error('No content available to generate PDF');
            }

            // Initialize jsPDF in landscape mode
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4'); // 'l' for landscape
            
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;
            let yOffset = margin;

            // Helper function to yield control to browser
            const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

            // Parse HTML content and extract text/tables
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.htmlContent;

            // Get computed styles function
            const getComputedStyleValue = (element, property) => {
                return window.getComputedStyle(previewContainer.querySelector(element.tagName.toLowerCase()) || element).getPropertyValue(property);
            };

            // Process direct children to maintain structure
            const processElement = async (element, level = 0) => {
                const tagName = element.tagName?.toLowerCase();
                if (!tagName) return;

                // Skip script and style tags
                if (tagName === 'script' || tagName === 'style') return;

                // Check if we need a new page
                if (yOffset > pageHeight - margin - 20) {
                    doc.addPage();
                    yOffset = margin;
                }

                // Get computed styles from the actual rendered element
                const actualElement = previewContainer.querySelector(`${tagName}`) || element;
                const color = getComputedStyleValue(actualElement, 'color');
                const fontSize = getComputedStyleValue(actualElement, 'font-size');
                const fontWeight = getComputedStyleValue(actualElement, 'font-weight');
                const isBold = fontWeight === 'bold' || parseInt(fontWeight) >= 700;

                if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
                    const sizeMap = { h1: 20, h2: 18, h3: 16, h4: 14, h5: 12, h6: 11 };
                    doc.setFontSize(sizeMap[tagName] || 14);
                    doc.setFont('helvetica', 'bold');
                    const text = element.textContent.trim();
                    if (text) {
                        const lines = doc.splitTextToSize(text, pageWidth - (margin * 2));
                        for (const line of lines) {
                            if (yOffset > pageHeight - margin - 10) {
                                doc.addPage();
                                yOffset = margin;
                            }
                            doc.text(line, margin, yOffset);
                            yOffset += 7;
                        }
                        yOffset += 3;
                    }
                    await yieldToBrowser();
                    
                } else if (tagName === 'p' || tagName === 'div' || tagName === 'span') {
                    // Only process if it has direct text content (not nested in other elements)
                    const directText = Array.from(element.childNodes)
                        .filter(node => node.nodeType === Node.TEXT_NODE)
                        .map(node => node.textContent.trim())
                        .join(' ');
                    
                    if (directText) {
                        doc.setFontSize(11);
                        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
                        const lines = doc.splitTextToSize(directText, pageWidth - (margin * 2));
                        
                        for (const line of lines) {
                            if (yOffset > pageHeight - margin - 10) {
                                doc.addPage();
                                yOffset = margin;
                            }
                            doc.text(line, margin, yOffset);
                            yOffset += 6;
                        }
                        yOffset += 2;
                        await yieldToBrowser();
                    }
                    
                    // Process children
                    for (const child of element.children) {
                        await processElement(child, level + 1);
                    }
                    
                } else if (tagName === 'table') {
                    // Extract table data with styling
                    const rows = Array.from(element.querySelectorAll('tr'));
                    const tableData = [];
                    let hasHeader = false;

                    rows.forEach((row, rowIndex) => {
                        const cells = Array.from(row.querySelectorAll('td, th'));
                        if (cells.length > 0) {
                            if (row.querySelector('th')) hasHeader = true;
                            tableData.push(cells.map(cell => cell.textContent.trim()));
                        }
                    });

                    if (tableData.length > 0) {
                        const headers = hasHeader ? [tableData[0]] : [];
                        const body = hasHeader ? tableData.slice(1) : tableData;

                        // Use autoTable if available
                        if (doc.autoTable) {
                            doc.autoTable({
                                startY: yOffset,
                                head: headers,
                                body: body,
                                theme: 'grid',
                                headStyles: { 
                                    fillColor: [102, 126, 234], 
                                    textColor: [255, 255, 255],
                                    fontStyle: 'bold',
                                    fontSize: 10,
                                    halign: 'left'
                                },
                                bodyStyles: { 
                                    textColor: [0, 0, 0],
                                    fontSize: 9
                                },
                                margin: { left: margin, right: margin },
                                styles: { 
                                    cellPadding: 4, 
                                    overflow: 'linebreak',
                                    cellWidth: 'wrap'
                                },
                                columnStyles: {
                                    0: { cellWidth: 'auto' }
                                }
                            });
                            yOffset = doc.lastAutoTable.finalY + 8;
                        } else {
                            // Simple table rendering if autoTable not available
                            tableData.forEach((row, index) => {
                                if (yOffset > pageHeight - margin - 10) {
                                    doc.addPage();
                                    yOffset = margin;
                                }
                                doc.setFontSize(9);
                                doc.setFont('helvetica', index === 0 && hasHeader ? 'bold' : 'normal');
                                const rowText = row.join(' | ');
                                const lines = doc.splitTextToSize(rowText, pageWidth - (margin * 2));
                                lines.forEach(line => {
                                    doc.text(line, margin, yOffset);
                                    yOffset += 5;
                                });
                            });
                            yOffset += 5;
                        }
                        await yieldToBrowser();
                    }
                    
                } else if (tagName === 'ul' || tagName === 'ol') {
                    const items = Array.from(element.querySelectorAll('li'));
                    items.forEach((item, index) => {
                        if (yOffset > pageHeight - margin - 10) {
                            doc.addPage();
                            yOffset = margin;
                        }
                        doc.setFontSize(11);
                        doc.setFont('helvetica', 'normal');
                        const bullet = tagName === 'ul' ? '• ' : `${index + 1}. `;
                        const text = item.textContent.trim();
                        const lines = doc.splitTextToSize(bullet + text, pageWidth - (margin * 2) - 5);
                        lines.forEach(line => {
                            doc.text(line, margin + 5, yOffset);
                            yOffset += 6;
                        });
                    });
                    yOffset += 3;
                    await yieldToBrowser();
                    
                } else if (tagName === 'br') {
                    yOffset += 5;
                    
                } else if (tagName === 'hr') {
                    doc.setDrawColor(200, 200, 200);
                    doc.line(margin, yOffset, pageWidth - margin, yOffset);
                    yOffset += 5;
                    
                } else if (tagName === 'strong' || tagName === 'b') {
                    const text = element.textContent.trim();
                    if (text) {
                        doc.setFontSize(11);
                        doc.setFont('helvetica', 'bold');
                        const lines = doc.splitTextToSize(text, pageWidth - (margin * 2));
                        for (const line of lines) {
                            if (yOffset > pageHeight - margin - 10) {
                                doc.addPage();
                                yOffset = margin;
                            }
                            doc.text(line, margin, yOffset);
                            yOffset += 6;
                        }
                    }
                    await yieldToBrowser();
                }
            };

            // Process all top-level children
            for (const child of tempDiv.children) {
                await processElement(child, 0);
            }

            // Download PDF
            doc.save(this.fileName);

            this.showToast('Success', 'PDF downloaded successfully!', 'success');

            // Close modal after successful download
            setTimeout(() => {
                this.handleClose();
            }, 1000);

        } catch (error) {
            this.errorMessage = 'Error generating PDF: ' + error.message;
            this.showToast('Error', 'Failed to generate PDF: ' + error.message, 'error');
            console.error('PDF Generation Error:', error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handle Cancel button click - close modal
     */
    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    /**
     * Show toast notification
     */
    showToast(title, message, variant) {
        const event = new ShowToastEvent({ title, message, variant });
        this.dispatchEvent(event);
    }

    /**
     * Disable download button if library not loaded or no content
     */
    get isDownloadDisabled() {
        return !this.jsPDFInitialized || !this.htmlContent || this.isLoading;
    }
}
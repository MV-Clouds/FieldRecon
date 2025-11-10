import { LightningElement, track, wire, api } from "lwc";
import getBillingData from "@salesforce/apex/AIAFormController.getBillingData";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { loadScript } from "lightning/platformResourceLoader";
import pdfLibs from "@salesforce/resourceUrl/pdfLibs";

export default class aIAForm extends LightningElement {
    @api recordId;
    @track billingRecord = {};
    @track contractList = []; // must be array
    @track changeOrderList = []; // must be array
    @track contractSums = {};
    @track changeOrderSummary = {};
    @track error;
    @track isOpen = true;
    @track isGeneratingPDF = false;
    @track pdfUrl = null;
    @track showPdfViewer = false;

    vfPageUrl = "/apex/wfrecon__AIABillingFormPDFGenerator";
    vfIframeReady = false;
    toContractor;
    project;
    applicationNo;
    distributionTo;
    fromSubcontractor;
    viaArchitect;
    periodTo;
    projectNo;
    originalContractSum;
    netchangebyChangeOrders;
    contractSUM;
    totalCompletedandStoredtoDate;
    contractDate;
    acccountName;
    isLoading = true;
    _previousBodyOverflow = null;
    _boundMessageHandler = null;
    _boundKeyHandler = null;
    pdfLibsInitialized = false;
    pdfJsLoaded = false;
	totalC;
	totalD;
	totalE;
	totalF;
    totalG;
    totalH;
    totalI;
    totalJ;

	changSumPrevious_Billed_Percent;
	changSumPrevious_Billed_Value;
	changSumThis_Billing_Percent;
	changSumTotal_Billing_Value_Retainage;
	changSumThis_Retainage_Amount;

    netChanges;
    previousAddition;
    previousDeduction;
    thisMonthAddition;
    thisMonthDeduction;
    totalAddition;
    totalDeduction;

    companyAddress;
    jobAddress;
    billEndDate;
    comName;
    totalContractValue;
    contractSumToDate;
    totalBilledAmount;
    wfreconRetainageOnBill;
    retainageCompletedToDate;
    totalAmountEarnedLessRetainage;
    lessPreviousCertificatedforPayment;
    currentPaymentDue;
    balanceToFinishRetainage;

    connectedCallback() {
        this._boundKeyHandler = this._handleKeydown.bind(this);
        window.addEventListener("keydown", this._boundKeyHandler);

        this._boundMessageHandler = this._handlePostMessage.bind(this);
        window.addEventListener("message", this._boundMessageHandler);

        if (this.recordId) {
            this.loadBillingData(this.recordId);
        } else {
            console.warn("No recordId found to fetch billing data");
            // this
        }
    }

    renderedCallback() {
		// Load PDF.js library
		if (this.pdfLibsInitialized) {
			return;
		}
		this.pdfLibsInitialized = true;
		loadScript(this, pdfLibs + "/pdfJS/web/pdf.js")
			.then(() => {
				console.log("PDF Libraries loaded successfully.");
			})
			.catch((error) => {
				console.error("Error loading PDF Libraries: ", error);
				this.showToast("Error", "Failed to load PDF libraries.", "error");
			});
	}

    disconnectedCallback() {
        window.removeEventListener("keydown", this._boundKeyHandler);
        this._boundKeyHandler = null;
        window.removeEventListener("message", this._boundMessageHandler);
        this._boundMessageHandler = null;
        this._restoreBodyOverflow();
    }

    _handlePostMessage(event) {
        const message = event.data || {};
        if (message.action === "vfReady") {
            this.vfIframeReady = true;
            console.log("VF iframe is ready");
            this.handleGeneratePDF();
        } else if (message.action === "pdfGenerated") {
            console.log("PDF generated successfully");
            this._handlePDFGenerated(message.pdfDataUri);
        } else if (message.action === "pdfError") {
            console.error("PDF generation error:", message.error);
            this.showToast("Error", "PDF generation failed: " + (message.error || "unknown"), "error");
            this.isGeneratingPDF = false;
        }
    }

    async loadBillingData(recordId) {
        this.isLoading = true;
        try {
            const data = await getBillingData({ recordId });
            
            if (!data) {
                console.warn("No data returned from Apex");
                this.initializeDefaultValues();
                this.isLoading = false;
                return;
            }

            console.log("Raw billing data from Apex:", data);

            this.billingRecord = data.billingRecord || {};
            this.contractList = data.contractLineItems || [];
            this.changeOrderList = data.changeOrderLineItems || [];
            this.contractSums = data.contractSums || {};
            this.changeOrderSummary = data.changeOrderSummary || {};
            this.error = undefined;

            const br = this.billingRecord;
            const job = (br && br.wfrecon__Job__r) ? br.wfrecon__Job__r : {};
            const account = (job && job.wfrecon__Account__r) ? job.wfrecon__Account__r : {};
            const architect = (job && job.wfrecon__Architect__r) ? job.wfrecon__Architect__r : {};

            // Safe field assignments with proper null checks
            this.toContractor = (job && job.wfrecon__Contractor__c) || "";
            this.acccountName = (account && account.Name) || "";
            this.project = (job && job.wfrecon__Job_Name__c) || "";
            this.applicationNo = (job && job.wfrecon__Job_Number__c) || "";
            this.distributionTo = (br && br.wfrecon__Distribution_To__c) || "";
            this.fromSubcontractor = (br && br.wfrecon__From_Subcontractor__c) || "";
            this.viaArchitect = (architect && architect.Name) || "";
            this.periodTo = (br && br.wfrecon__Period_To__c) || "";
            this.projectNo = (job && job.Name) || "";
            this.originalContractSum = (job && job.wfrecon__Total_Contract_Price__c) || 0;
            
            const changeOrderValue = (job && job.wfrecon__Total_Change_Order_Value__c) || 0;
            this.netchangebyChangeOrders = this.formatCurrency(changeOrderValue);
            
            this.contractSUM = (br && br.wfrecon__Total_Contract_Sum__c) || 0;
            this.totalCompletedandStoredtoDate = (br && br.wfrecon__Total_Completed_Stored_to_Date__c) || 0;
                this.jobAddress = [
                    (job && job.wfrecon__Street__c) || "",
                    (job && job.wfrecon__City__c) || "",
                    (job && job.wfrecon__State__c) || "",
                    (job && job.wfrecon__Zip_Code__c) || "",
                    (job && job.wfrecon__Country__c) || ""
                ]
                .filter(part => part && part.trim() !== '')
                .join(', '); 
                
                this.billEndDate = (br && br.wfrecon__End_Date__c) || "";
                this.contractDate = (job && job.Contract_Date__c) || "";
                
                // Format all currency values with proper null checks
                this.totalContractValue = this.formatCurrency((job && job.wfrecon__Total_Contract_Value__c) || 0);
                this.contractSumToDate = this.formatCurrency((br && br.wfrecon__Contract_Sum_to_Date__c) || 0);
                this.totalBilledAmount = this.formatCurrency((br && br.wfrecon__Total_Billed_Amount__c) || 0);
                this.wfreconRetainageOnBill = this.formatCurrency((br && br.wfrecon__Retainage_on_Bill__c) || 0);
                this.retainageCompletedToDate = this.formatCurrency((br && br.wfrecon__Retainage_Completed_to_Date__c) || 0);
                this.totalAmountEarnedLessRetainage = this.formatCurrency((br && br.wfrecon__Total_Amount_Earned_Less_Retainage__c) || 0);
                this.lessPreviousCertificatedforPayment = this.formatCurrency((br && br.wfrecon__Less_Previous_Certificated_for_Payment__c) || 0);
                this.currentPaymentDue = this.formatCurrency((br && br.wfrecon__Current_Payment_Due_FM__c) || 0);
                this.balanceToFinishRetainage = this.formatCurrency((br && br.wfrecon__Balance_to_Finish_Retainage__c) || 0); 
                
                const conSum = this.contractSums || {};
                this.totalC = this.formatCurrency(conSum.totalC);
                this.totalD = this.formatCurrency(conSum.totalD);
                this.totalE = this.formatCurrency(conSum.totalE);
                this.totalF = this.formatCurrency(conSum.totalF);
                this.totalG = this.formatCurrency(conSum.totalG);
                this.totalH = this.formatCurrency(conSum.totalH);
                this.totalI = this.formatCurrency(conSum.totalI);
                this.totalJ = this.formatCurrency(conSum.totalJ);

                const changeOrderSum = this.changeOrderSummary || {};
                this.netChanges = this.formatCurrency(changeOrderSum.netChanges);
                this.previousAddition = this.formatCurrency(changeOrderSum.previousAddition);
                this.previousDeduction = this.formatCurrency(changeOrderSum.previousDeduction);
                this.thisMonthAddition = this.formatCurrency(changeOrderSum.thisMonthAddition);
                this.thisMonthDeduction = this.formatCurrency(changeOrderSum.thisMonthDeduction);
                this.totalAddition = this.formatCurrency(changeOrderSum.totalAddition);
                this.totalDeduction = this.formatCurrency(changeOrderSum.totalDeduction);
                this.companyAddress = changeOrderSum.companyAddress || "";
                this.comName = changeOrderSum.comName || "";

                const container = this.template.querySelector('.dynamic-container');
                const tabel2 = this.template.querySelector('.dynamic-container-2tabel');
                let pageNo = 3;
                let tableCount = 0;
                let lastChunkCount = 0;
                let totalTabelContractList = 0;
                if (container) {
                    let htmlContent = '';

                    // Table header (keep your same style)
                    const buildHeader = () => `
                        <tr>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:4%; font-size:8pt; font-weight:bold;">No.</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:23%; font-size:8pt; font-weight:bold;">Description of Work</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold;">Scheduled Value</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold;">From Previous Applications (WORK COMPLETED)</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold;">This Period In Place (WORK COMPLETED)</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold;">Total Completed and Stored To Date (D+E+F)</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold;">%(G/C)</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold;">Balance To Finish (C-G)</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold;">Retainage</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold;">Retainage Previous Application</td>
                        </tr>`;

                    // Build one table chunk of items
                    const buildTable = (list, startIndex, endIndex) => {
                        let rows = '';
                        list.slice(startIndex, endIndex).forEach((item, i) => {
                            rows += `
                                <tr>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">${startIndex + i + 1}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">${item.wfrecon__Scope_Entry__r || ''}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">$${item.wfrecon__Scope_Contract_Amount__c || '0.00'}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">$${item.wfrecon__Previous_Billed_Value__c || '0.00'}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">$${item.wfrecon__This_Billing_Value__c || '0.00'}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">$${item.sumD_E || '0.00'}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">${item.vlueOf_G || '0'}%</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">$${item.vlueof_H || '0.00'}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">${item.wfrecon__Retainage_Percent_on_Bill_Line_Item__c || '0'}%</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">$${item.wfrecon__Retainage_Percent_on_Bill_Line_Item__r || '0.00'}</td>
                                </tr>`;
                        });

                        return `
                            <table role="presentation" style="width:100%; border-collapse:collapse; margin-top:8pt;">
                                <thead>${buildHeader()}</thead>
                                <tbody>${rows}</tbody>
                            </table>
                            `;
                    };

                    // Create multiple tables (10 rows each)
                    let chunkSize = 22;
                    // let pageNo = 3;
                    

                    for (let i = 0; i < this.contractList.length; i += chunkSize) {
                        const end = Math.min(i + chunkSize, this.contractList.length);
                        lastChunkCount = end - i; // <-- count rows in last chunk

                        if (tableCount == 0) {
                            // console.log('tableCount *** : ', tableCount);
                            htmlContent += buildTable(this.contractList, i, end);
                            tableCount++;
                            chunkSize = 29;
                        } else {
                            // console.log('tableCount else *** : ', tableCount);
                            htmlContent += `<div style="width: 100%; display:flex; justify-content: space-between;  margin-top:30pt;">
                                                <div style="font-weight: bold; font-size: 8pt;">SCHEDULE OF VALUES</div>
                                                <div style="font-weight: bold; font-size: 8pt;">Page ${pageNo}</div>
                                            </div>
                                            <hr style="border: 1px solid #000" />`;
                            htmlContent += buildTable(this.contractList, i, end);
                            tableCount++;
                            pageNo++;
                        }
                    }

                    // ✅ Log total number of chunks and last chunk size
                    // console.log('Total number of table chunks:', tableCount);
                    // console.log('Number of rows in last chunk:', lastChunkCount);
                    totalTabelContractList = tableCount;

                    container.innerHTML = htmlContent;
                }

                if (tabel2) {
                    let htmlContent = '';
                    const buildHeader = () => `
                        <tr>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:4%; font-size:8pt; font-weight:bold; padding:4pt 0pt;">CO</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:23%; font-size:8pt; font-weight:bold; padding:4pt 0pt;">&nbsp;</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold; padding:4pt 0pt;">&nbsp;</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold; padding:4pt 0pt;">&nbsp;</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold; padding:4pt 0pt;">&nbsp;</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold; padding:4pt 0pt;">&nbsp;</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold; padding:4pt 0pt;">&nbsp;</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold; padding:4pt 0pt;">&nbsp;</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold; padding:4pt 0pt;">&nbsp;</td>
                            <td style="background-color:#dfdcdc; border:1px solid #000; text-align:center; width:7%; font-size:8pt; font-weight:bold; padding:4pt 0pt;">&nbsp;</td>
                        </tr>`;

                    // Build one table chunk of 10 items
                    const buildTable = (list, startIndex, endIndex) => {
                        let rows = '';
                        list.slice(startIndex, endIndex).forEach((item, i) => {
                            rows += `
                                <tr>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">${startIndex + i + 1}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">${item.wfrecon__Scope_Entry__r || ''}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">$${item.wfrecon__Scope_Contract_Amount__c || '0.00'}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">$${item.wfrecon__Previous_Billed_Value__c || '0.00'}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">$${item.wfrecon__This_Billing_Value__c || '0.00'}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">$${item.sumD_E || '0.00'}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">${item.vlueOf_G || '0'}%</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">$${item.vlueof_H || '0.00'}</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">${item.wfrecon__Retainage_Percent_on_Bill_Line_Item__c || '0'}%</td>
                                    <td style="border:1pt solid #000; padding:4pt; font-size:8pt; font-weight:bold;">$${item.wfrecon__Retainage_Percent_on_Bill_Line_Item__r || '0.00'}</td>
                                </tr>`;
                        });

                        return `
                            <table role="presentation" style="width:100%; border-collapse:collapse; margin-top:8pt;">
                                <thead>${buildHeader()}</thead>
                                <tbody>${rows}</tbody>
                            </table>`;
                    };

                    // Create multiple tables (10 rows each)
                    
                    let chunkSize = 30;
                    if(lastChunkCount >= 30){
                        chunkSize = 32;
                        // console.log('you are in 1 if');
                        
                    }else{
                        if(lastChunkCount < 26){
                            chunkSize = 28-lastChunkCount;
                            // console.log('you are in 2 if');
                        }else{
                        chunkSize = 32;
                        // console.log('you are in  2 if elase');
                        }
                        
                    }
                    let tableCount = 0;
                    for (let i = 0; i < this.changeOrderList.length; i += chunkSize) {
                        if(tableCount == 0){
                            // console.log('tableCount *** : ',tableCount);
                            const end = Math.min(i + chunkSize, this.changeOrderList.length);
                            if (chunkSize == 30 || totalTabelContractList == 1 && lastChunkCount == 19 ) {
                            htmlContent += `<div style="margin-top: 40px;"></div>
                                            <div style="width: 100%; display:flex; justify-content: space-between;">
                                                <div style="font-weight: bold; font-size: 8pt;">SCHEDULE OF VALUES</div>
                                                <div style="font-weight: bold; font-size: 8pt;">Page ${pageNo}</div>
                                            </div>
                                            <hr style="border: 1px solid #000" />`;
                            }
                            htmlContent += buildTable(this.changeOrderList, i, end);
                            tableCount++;
                            chunkSize = 30;
                        }else{
                            // console.log('tableCount else *** : ',tableCount);
                            const end = Math.min(i + chunkSize, this.changeOrderList.length);
                            htmlContent += `<div style="margin-top: 40px;"></div>
                                            <div style="width: 100%; display:flex; justify-content: space-between">
                                                <div style="font-weight: bold; font-size: 8pt;">SCHEDULE OF VALUES</div>
                                                <div style="font-weight: bold; font-size: 8pt;">Page ${pageNo}</div>
                                            </div>
                                            <hr style="border: 1px solid #000" />`;
                            htmlContent += buildTable(this.changeOrderList, i, end);
                            tableCount++;

                        }
                    }
                    tabel2.innerHTML = htmlContent;

                }

        } catch (error) {
            console.error("Error fetching billing data in catch:", error);
            console.error("Error message:", error.message);
            console.error("Error body:", error.body);
            console.error("Error stack:", error.stack);
            console.error("Full error object:", JSON.stringify(error));
            this.error = error;
            this.initializeDefaultValues();
            
            let errorMessage = "Failed to load billing data.";
            if (error.body && error.body.message) {
                errorMessage = error.body.message;
            } else if (error.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            
            this.showToast("Error", errorMessage, "error");
        } finally {
            // Keep spinner until PDF is generated
            // this.isLoading = false will be set in _handlePDFGenerated
        }
    }

    // Helper method to format currency
    formatCurrency(value) {
        const numValue = Number(value) || 0;
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numValue);
    }

    // Helper method to initialize default values
    initializeDefaultValues() {
        this.billingRecord = {};
        this.contractList = [];
        this.changeOrderList = [];
        this.contractSums = {};
        this.changeOrderSummary = {};
        
        // Set all display values to default
        this.toContractor = "";
        this.acccountName = "";
        this.project = "";
        this.applicationNo = "";
        this.distributionTo = "";
        this.fromSubcontractor = "";
        this.viaArchitect = "";
        this.periodTo = "";
        this.projectNo = "";
        this.originalContractSum = 0;
        this.netchangebyChangeOrders = "0.00";
        this.contractSUM = 0;
        this.totalCompletedandStoredtoDate = 0;
        this.jobAddress = "";
        this.billEndDate = "";
        this.contractDate = "";
        this.totalContractValue = "0.00";
        this.contractSumToDate = "0.00";
        this.totalBilledAmount = "0.00";
        this.wfreconRetainageOnBill = "0.00";
        this.retainageCompletedToDate = "0.00";
        this.totalAmountEarnedLessRetainage = "0.00";
        this.lessPreviousCertificatedforPayment = "0.00";
        this.currentPaymentDue = "0.00";
        this.balanceToFinishRetainage = "0.00";
        this.totalC = "0.00";
        this.totalD = "0.00";
        this.totalE = "0.00";
        this.totalF = "0.00";
        this.totalG = "0.00";
        this.totalH = "0.00";
        this.totalI = "0.00";
        this.totalJ = "0.00";
        this.netChanges = "0.00";
        this.previousAddition = "0.00";
        this.previousDeduction = "0.00";
        this.thisMonthAddition = "0.00";
        this.thisMonthDeduction = "0.00";
        this.totalAddition = "0.00";
        this.totalDeduction = "0.00";
        this.companyAddress = "";
        this.comName = "";
    }

    // UI helpers
    @api open() {
        this.isOpen = true;
        this._lockBodyScroll();
    }
    @api close() {
        this.isOpen = false;
        this._restoreBodyOverflow();
        if (this.pdfUrl) {
            try { URL.revokeObjectURL(this.pdfUrl); } catch (e) {}
            this.pdfUrl = null;
        }
        this.showPdfViewer = false;
        this.dispatchEvent(new CustomEvent("close"));
    }
    stopPropagation(e) { e.stopPropagation(); }
    handleBackdropClick() { this.close(); }
    toggleView() {
        this.showPdfViewer = !this.showPdfViewer;
        if (this.showPdfViewer && this.pdfUrl) {
            setTimeout(() => this._renderPdfWithPdfJs(this.pdfUrl), 0);
        }
    }
    @api previewPDF() {
        if (!this.pdfUrl) {
            this.showToast("Warning", "No PDF available. Please generate a PDF first.", "warning");
            return;
        }
        this.showPdfViewer = true;
        setTimeout(() => this._renderPdfWithPdfJs(this.pdfUrl), 0);
    }
    @api hidePDFPreview() { this.showPdfViewer = false; }

    _handleKeydown(event) {
        if (event.key === "Escape" && this.isOpen) this.close();
    }
    _lockBodyScroll() {
        try { 
            this._previousBodyOverflow = document.body.style.overflow; 
            document.body.style.overflow = "hidden"; 
        } catch (e) {
            console.error("Error locking body scroll:", e);
        }
    }
    _restoreBodyOverflow() {
        try {
            if (this._previousBodyOverflow !== null) {
                document.body.style.overflow = this._previousBodyOverflow;
                this._previousBodyOverflow = null;
            } else {
                document.body.style.overflow = "";
            }
        } catch (e) {
            console.error("Error restoring body overflow:", e);
        }
    }

    get pdfButtonLabel() { return this.isGeneratingPDF ? "Generating PDF..." : "Generate PDF"; }
    get toggleViewLabel() { return this.showPdfViewer ? "Show Form Content" : "Show PDF Preview"; }
    get formContentClass() { return this.showPdfViewer ? "test123 hidden" : "test123"; }

    async handleGeneratePDF() {
        try {
            if (!this.vfIframeReady) {
                this.showToast("Warning", "PDF generator is not ready yet. Please wait...", "warning");
                return;
            }
            
            const bodyElement = this.template.querySelector(".test123");
            if (!bodyElement) {
                console.error("Element with class .test123 not found");
                this.showToast("Error", "Element to convert not found.", "error");
                return;
            }

            let htmlString = bodyElement.outerHTML;
            htmlString = htmlString
                .replaceAll("<hr>", '<br clear="all" style="page-break-before:always"/>')
                .replaceAll("</hr>", "")
                .replaceAll("<hr/>", '<br clear="all" style="page-break-before:always"/>');

            const options = {
                margin: [0, 0, 0, 0],
                filename: "AIA-Billing-Form.pdf",
                image: { type: "jpeg", quality: 1 },
                html2canvas: { scale: 3, useCORS: true, letterRendering: true },
                // pagebreak: { mode: ["avoid-all", "css", "legacy"] },
                pagebreak: { mode: ['css', 'legacy'], before: '.html2pdf__page-break' },
                jsPDF: { unit: "px", format: "letter", orientation: "landscape", hotfixes: ["px_scaling"] }
            };

            this.isGeneratingPDF = true;
            // this.isLoading = false;

            const iframe = this.template.querySelector(".vf-pdf-iframe");
            if (!iframe || !iframe.contentWindow) {
                throw new Error("VF iframe not found or not accessible");
                this.isLoading = false;
            }

            iframe.contentWindow.postMessage(
                {
                    action: "generatePDF",
                    htmlContent: htmlString,
                    options: options
                },
                "*" // in prod, replace with specific origin
            );

        } catch (err) {
            console.error("Error in handleGeneratePDF:", err.message);
            this.showToast("Error", "PDF generation error. Check console.", "error");
            this.isGeneratingPDF = false;
            this.isLoading = false;
        }
    }

    _handlePDFGenerated(pdfDataUri) {
        try {
            console.log("PDF generated successfully");
            this.isGeneratingPDF = false;
            this.pdfUrl = pdfDataUri;
            this.showPdfViewer = true;
            this._renderPdfWithPdfJs(pdfDataUri);
            this.showToast("Success", "PDF generated successfully!", "success");
            // Turn off spinner after PDF is generated
            this.isLoading = false;
        } catch (err) {
            console.error("Error handling generated PDF:", err);
            this.showToast("Error", "Failed to display PDF.", "error");
            this.isLoading = false;
        }
    }

    async _renderPdfWithPdfJs(pdfDataUri) {
        try {
            // if (!this.pdfJsLoaded || !window.pdfjsLib) {
            //     console.warn("PDF.js not loaded - cannot preview.");
            //     return;
            // }
            const data = this.base64ToUint8Array(pdfDataUri.split(",")[1]);
            const pdfContent = this.template.querySelector(".pdf-canvas-container");
            if (!pdfContent) {
                console.warn("No pdf-canvas-container in template");
                return;
            }
            pdfContent.innerHTML = "";

            const loadingTask = window.pdfjsDistBuildPdf.getDocument({ data });
            const pdf = await loadingTask.promise;

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const scale = 1.5;
                const viewport = page.getViewport(scale);
                const canvas = document.createElement("canvas");
                pdfContent.appendChild(canvas);
                const context = canvas.getContext("2d");
                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                canvas.classList.add("canvasClass");
                canvas.style.width = "inherit !important";
                await page.render({ canvasContext: context, viewport }).promise;
            }
        } catch (err) {
            console.error("Error rendering PDF with PDF.js:", err.stack);
            this.showToast("Error", "Failed to render PDF preview.", "err");
        }
    }

    base64ToUint8Array(base64) {
        const raw = atob(base64 || "");
        const uint8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
            uint8Array[i] = raw.charCodeAt(i);
        }
        return uint8Array;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }
}
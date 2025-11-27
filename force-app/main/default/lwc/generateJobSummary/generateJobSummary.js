import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import generateJobSummary from '@salesforce/apex/AICalloutController.generateJobSummary';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import USER_OBJECT from '@salesforce/schema/User';
import Preferred_Language_Field from '@salesforce/schema/User.Preferred_Native_Language__c';
import getUserDesignation from '@salesforce/apex/AICalloutController.getUserDesignation';
import userId from '@salesforce/user/Id';
import { getRecord } from 'lightning/uiRecordApi';
import { Text_To_Speech } from 'c/cmp_TextToSpeech';

// Note: this is universal for all the salesforce orgs, use this id if the object's default record type is null
let MASTER_RECORD_TYPE = '012000000000000AAA'

export default class GenerateJobSummary extends LightningElement {
    @api recordId;
    startDate;
    endDate;
    loading = false;
    jobSummary;
    timeIntervalOptions = [
        { label: 'Whole Job', value: 'all' },
        { label: 'This Week', value: 'this_Week' },
        { label: 'Specific Dates', value: 'custom_Duration' }
    ];
    selectedDurationType = 'all';
    
    visibilityOptions = [
        { label: 'All Work', value: 'all_work' },
        { label: 'My Work', value: 'my_work' }
    ];
    selectedVisibility = 'all_work';

    isJobManager = false;

    @wire(getUserDesignation)
    userDesignation({data, error}){
        if (data) {
            this.isJobManager = data.isJobManager;
        } else if (error) {
            console.error('Error fetching user designation:', error);
        }
    }

    get isCustomTimeInterval() {
        return this.selectedDurationType === 'custom_Duration';
    }

    @track languages = [];
    selectedLanguage = 'en-US';
    selectedLanguage_Label = 'English'

    get disableSummarizeBtn(){
        return !this.selectedLanguage || !this.selectedDurationType 
            || (this.selectedDurationType === 'custom_Duration' && (!this.startDate || !this.endDate))
    }

    get userObjRecordType(){
        return this.objectInfo.data?.defaultRecordTypeId ?? MASTER_RECORD_TYPE;
    }

    textToSpeech = new Text_To_Speech();

    // Get object metadata (to access record type ID)
    @wire(getObjectInfo, { objectApiName: USER_OBJECT })
    objectInfo;

    // Get picklist values for Preferred_Native_Language__c
    @wire(getPicklistValues, { recordTypeId: '$userObjRecordType', fieldApiName: Preferred_Language_Field})
    languagePicklistValues(result){
        const { data, error } = result;
        if (data) {
            this.languages = JSON.parse(JSON.stringify(data?.values));
        } else if (error) {
            console.error('Error fetching picklist values:', error);
        }
    }
    
    @wire(getRecord, { recordId: userId, fields: [Preferred_Language_Field] })
    userLanguage({data, error}){
        if (data) {
            this.selectedLanguage = data.fields.Preferred_Native_Language__c?.value;
            this.selectedLanguage_Label = data.fields.Preferred_Native_Language__c?.displayValue;
        } else if (error) {
            console.error('Error fetching user record > Preferred_Native_Language__c field:', error);
        }
    }

    
    handleChange (event){
        if(event.target.name === 'startDate'){
            this.startDate = event.target.value;
        }else if(event.target.name === 'endDate'){
            this.endDate = event.target.value;
        }else if(event.target.name === 'language'){
            this.selectedLanguage = event.target.value;
            this.selectedLanguage_Label = this.languages?.find(option => option.value === event.target.value)?.label;
        }else if(event.target.name === 'durationType'){
            this.selectedDurationType = event.target.value;
        }else if(event.target.name === 'visibility'){
            this.selectedDurationType = event.target.value;
        }
    }

    handleClick(event){
        this.loading = true;
        this.jobSummary = '';
        console.log('this.recordId', this.recordId);
        console.log('this.startDate', this.startDate);
        console.log('this.endDate', this.endDate);
        console.log('this.selectedLanguage', this.selectedLanguage);

        const requestData = {
            jobId: this.recordId,
            durationType: this.selectedDurationType,
            language: `${this.selectedLanguage} (${this.selectedLanguage_Label})`,
            userVisibilityChoice: this.selectedVisibility
        };

        if(requestData.durationType === 'custom_Duration'){
            requestData.startDate = this.startDate;
            requestData.endDate = this.endDate;
        }

        const missingKey = Object.keys(requestData).find(key => !requestData[key]);
        
        const errorKeyMapping = {
            jobId: 'Job',
            startDate: 'Start Date',
            endDate: 'End Date',
            language: 'Language',
            durationType: 'Interval Type',
            userVisibilityChoice: 'Visibility'
        };

        if (missingKey) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: `Please enter ${errorKeyMapping[missingKey]}`,
                    variant: 'error',
                })
            );
            this.loading = false;
            return;
        }

        console.log('requestData', requestData);

        ttsContent = '';
        generateJobSummary({inputData: JSON.stringify(requestData)})
            .then(result => {
                // this.jobSummary = result.slice(7);
                
                // this.jobSummary = result.replace(/```html|```/g, '').trim();
                try {

                    this.jobSummary = JSON.parse(result.ai_Response__c || '[]');
                    console.log('this.jobSummary', this.jobSummary);
                    const htmlContent = this.generateJobSummaryHTML(this.jobSummary);
                    this.template.querySelector(".summaryContainer").innerHTML = htmlContent;
                    console.log('htmlContent : ', htmlContent);
                    const tts_htmlContent = this.htmlToSpeechText(htmlContent);
                    this.ttsContent = this.convertToSSML(tts_htmlContent);
                    console.log('ttsContent : ', this.ttsContent);
                    
                } catch (error) {
                    console.log('error', error.stack);
                }

                console.log('result', result);
                this.loading = false;
            })
            .catch(error => {
                console.log('error', error);
            });
    }

    labels = {};
    generateJobSummaryHTML(data) {
    try {
        const job = data.JobOverview || {};
        const summary = data.ShiftLogSummary || {};
        const notes = data.NotesForOffice || [];
        const health = data.OverallJobHealthSummary || {};
        this.labels = data.Label || {};                // <-- Label object from AI
        const reportDate = data.ReportMetaData?.ReportDate || "";

        function formatDate(dateStr) {
            if (!dateStr) return "";
            const date = new Date(dateStr);
            return date.toLocaleDateString("en-US", { day: 'numeric', month: 'long', year: 'numeric' });
        }

        return `
            <div class="frJobSummary__v1" style="font-family:'Segoe UI',Arial,sans-serif;color:#333;line-height:1.6;max-width:900px;margin:auto;padding:30px;background:#fafafa;">
            <style>
                @media screen and (max-width: 600px){ .frJobSummary__v1 {padding: 0px !important;} .frJobSummary__v1 .sub-section {padding: 12px !important;} }
            </style>
            <div class="sub-section" style="background:#ffffff;padding:25px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.08);">

                <h1 style="color:#0f172a;font-size:26px;margin-bottom:5px;">Job Summary Report</h1>
                <p style="font-size:13px;color:#555;margin-top:0;margin-bottom:15px;">${this.getLabel("ReportDate")}: ${formatDate(reportDate)}</p>
                <hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0;" />

                <!-- Job Overview -->
                <h2 style="color:#1e293b;font-size:18px;margin-bottom:8px;">${this.getLabel("JobOverviewTitle")}</h2>
                <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:15px;">
                    <tbody>
                        <tr>
                            <td style="padding:8px;border:1px solid #ddd;background:#f9fafb;"><strong>${this.getLabel("JobName")}</strong></td>
                            <td style="padding:8px;border:1px solid #ddd;">${job.JobName || ""}</td>
                        </tr>
                        <tr>
                            <td style="padding:8px;border:1px solid #ddd;background:#f9fafb;"><strong>${this.getLabel("Status")}</strong></td>
                            <td style="padding:8px;border:1px solid #ddd;">${job.Status || ""}</td>
                        </tr>
                        <tr>
                            <td style="padding:8px;border:1px solid #ddd;background:#f9fafb;"><strong>${this.getLabel("Location")}</strong></td>
                            <td style="padding:8px;border:1px solid #ddd;" colspan="3">${job.Location || ""}</td>
                        </tr>
                        <tr>
                            <td style="padding:8px;border:1px solid #ddd;background:#f9fafb;"><strong>${this.getLabel("ContractPrice")}</strong></td>
                            <td style="padding:8px;border:1px solid #ddd;">₹${job.ContractPrice || "0.00"}</td>
                        <tr>
                        </tr>
                            <td style="padding:8px;border:1px solid #ddd;background:#f9fafb;"><strong>${this.getLabel("TotalManHoursLogged")}</strong></td>
                            <td style="padding:8px;border:1px solid #ddd;">${job.TotalManHoursLogged || "0"} hrs</td>
                        </tr>
                        <tr>
                            <td style="padding:8px;border:1px solid #ddd;background:#f9fafb;"><strong>${this.getLabel("TotalContractValue")}</strong></td>
                            <td style="padding:8px;border:1px solid #ddd;">₹${job.TotalContractValue || "0.00"}</td>
                        <tr>
                        </tr>
                            <td style="padding:8px;border:1px solid #ddd;background:#f9fafb;"><strong>${this.getLabel("Mobilizations")}</strong></td>
                            <td style="padding:8px;border:1px solid #ddd;">${job.Mobilizations || 0}</td>
                        </tr>
                    </tbody>
                </table>

                <hr style="border:0;border-top:1px solid #e2e8f0;margin:30px 0;" />

                <!-- Work Progress Summary -->
                <h2 style="color:#1e293b;font-size:18px;">${this.getLabel("WorkProgressSummaryTitle")}</h2>
                <p style="margin-top:5px;font-size:14px;"><strong>${this.getLabel("GroupedByWorkDates")}</strong></p>

                <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:5px;">
                    <tbody>
                        <tr>
                            <th style="padding:10px;border:1px solid #ddd;background:#f1f5f9;text-align:left;">${this.getLabel("Date")}</th>
                            <th style="padding:10px;border:1px solid #ddd;background:#f1f5f9;text-align:left;">${this.getLabel("SummaryOfKeyWorkActivities")}</th>
                        </tr>
                        ${summary.EachLogSummary?.map(log => `
                        <tr>
                            <td style="padding:8px;border:1px solid #ddd;">${formatDate(log.Date)}</td>
                            <td style="padding:8px;border:1px solid #ddd;">${log.SummaryOfKeyWorkActivities}</td>
                        </tr>`).join('') || ""}
                    </tbody>
                </table>
                <p style="font-size:14px;margin-top:12px;"><strong>${this.getLabel("OverallWorkSummary")}:</strong><br>${summary.WorkPerformedOverallSummary || ""}</p>

                <hr style="border:0;border-top:1px solid #e2e8f0;margin:30px 0;" />

                <!-- Exceptions / Challenges -->
                <h2 style="color:#1e293b;font-size:18px;">${this.getLabel("ExceptionsChallengesTitle")}</h2>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <tbody>
                        <tr>
                            <th style="padding:10px;border:1px solid #ddd;background:#f1f5f9;text-align:left;">${this.getLabel("Date")}</th>
                            <th style="padding:10px;border:1px solid #ddd;background:#f1f5f9;text-align:left;">${this.getLabel("ExceptionCause")}</th>
                        </tr>
                        ${summary.EachLogSummary?.map(log => `
                        <tr>
                            <td style="padding:8px;border:1px solid #ddd;">${formatDate(log.Date)}</td>
                            <td style="padding:8px;border:1px solid #ddd;">${log.ExceptionCause || ""}</td>
                        </tr>`).join('') || ""}
                    </tbody>
                </table>
                <p style="font-size:14px;margin-top:12px;"><strong>${this.getLabel("ExceptionOverallSummary")}:</strong><br>${summary.ExceptionOverallSummary || ""}</p>

                <hr style="border:0;border-top:1px solid #e2e8f0;margin:30px 0;" />

                <!-- Notes for Office -->
                <h2 style="color:#1e293b;font-size:18px;">${this.getLabel("NotesForOfficeTitle")}</h2>
                <ul style="font-size:14px;margin-top:5px;padding-left:20px;">
                    ${notes.map(n => `<li style="margin-bottom:4px;list-style: disc">${n}</li>`).join('')}
                </ul>

                <hr style="border:0;border-top:1px solid #e2e8f0;margin:30px 0;" />

                <!-- Overall Job Health Summary -->
                <h2 style="color:#1e293b;font-size:18px;">${this.getLabel("OverallJobHealthSummaryTitle")}</h2>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <tbody>
                        <tr>
                            <td style="padding:8px;border:1px solid #ddd;background:#f9fafb;"><strong>${this.getLabel("ScheduleProgress")}</strong></td>
                            <td style="padding:8px;border:1px solid #ddd;">${health.Progress || ""}</td>
                        </tr>
                        <tr>
                            <td style="padding:8px;border:1px solid #ddd;background:#f9fafb;"><strong>${this.getLabel("CommunicationEfficiency")}</strong></td>
                            <td style="padding:8px;border:1px solid #ddd;">${health.Efficiency || ""}</td>
                        </tr>
                        <tr>
                            <td style="padding:8px;border:1px solid #ddd;background:#f9fafb;"><strong>${this.getLabel("ResourceUtilization")}</strong></td>
                            <td style="padding:8px;border:1px solid #ddd;">${health.ResourceUtilization || ""}</td>
                        </tr>
                        <tr>
                            <td style="padding:8px;border:1px solid #ddd;background:#f9fafb;"><strong>${this.getLabel("DocumentationStatus")}</strong></td>
                            <td style="padding:8px;border:1px solid #ddd;">${health.Status || ""}</td>
                        </tr>
                    </tbody>
                </table>

                <hr style="border:0;border-top:1px solid #e2e8f0;margin:30px 0;" />

                <!-- Final Summary -->
                <h2 style="color:#1e293b;font-size:18px;">${this.getLabel("FinalSummaryTitle")}</h2>
                <p style="font-size:14px;">${data.FinalSummary || ""}</p>

            </div>
            </div>
        `;
                
        } catch (error) {
            console.log('error in generateJobSummaryHTML : ', error.stack);
            
        }
    }

    getLabel(labelKey) {
        return this.labels?.[labelKey] || this.defaultLabels[labelKey] || labelKey;
    }

    htmlToSpeechText(html) {
        // Create a temporary container
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;

        // Remove scripts, styles, and hidden elements
        tempDiv.querySelectorAll("script, style, noscript").forEach(el => el.remove());

        // Replace <br> and <li> with spoken pauses
        tempDiv.querySelectorAll("br").forEach(el => el.replaceWith("\n"));
        tempDiv.querySelectorAll("li").forEach(el => {
            el.replaceWith(`• ${el.textContent.trim()}\n`);
        });

        // Format table rows naturally for speech
        tempDiv.querySelectorAll("tr").forEach(row => {
            let cells = [...row.querySelectorAll("td, th")].map(td => td.textContent.trim());
            if (cells.length) row.replaceWith(cells.join(": ") + "\n");
        });

        //  Get final text while keeping paragraph breaks
        let speechText = tempDiv.innerText
            .replace(/\s+/g, " ")         // Fix excessive spaces
            .replace(/\n\s*\n/g, "\n")    // Clean empty lines
            .replace(/₹/g, "rupees ")     // Fix currency
            .replace(/%/g, " percent ")   // Fix percentage
            .trim();

        // Add natural speech pauses
        speechText = speechText
            .replace(/:/g, ". ")          // Change colons to pauses
            .replace(/\./g, ". ")         // Ensure full-stop spacing
            .replace(/,/g, ", ");         // Ensure comma pauses

        return speechText;
    }

    convertToSSML(text) {
        return `
            <speak>
                ${text
                    .replace(/\n/g, "<break time='500ms'/>")
                    .replace(/\. /g, ". <break time='400ms'/>")
                    .replace(/:/g, "<break time='300ms'/>")
                }
            </speak>
        `.trim();
    }

    defaultLabels = {
        JobOverviewTitle: "Job Overview",
        JobName: "Job Name",
        Status: "Status",
        Location: "Location",
        ContractPrice: "Contract Price",
        TotalManHoursLogged: "Total Man Hours Logged",
        TotalContractValue: "Total Contract Value",
        Mobilizations: "Mobilizations",

        WorkProgressSummaryTitle: "Work Progress Summary (By Each Day)",
        GroupedByWorkDates: "Grouped by Work Dates:",
        Date: "Date",
        SummaryOfKeyWorkActivities: "Summary of Key Work Activities",
        OverallWorkSummary: "Overall Summary",

        ExceptionsChallengesTitle: "Exceptions / Challenges",
        ExceptionCause: "Exception / Cause",
        ExceptionOverallSummary: "Summary",

        NotesForOfficeTitle: "Notes for Office",

        OverallJobHealthSummaryTitle: "Overall Job Health Summary",
        ScheduleProgress: "Schedule Progress",
        CommunicationEfficiency: "Communication Efficiency",
        ResourceUtilization: "Resource Utilization",
        DocumentationStatus: "Documentation Status",

        FinalSummaryTitle: "Final Summary",
        ReportDate: "Report Date"
    };


    
}
public without sharing class ProposalPageController {
    public String recordID { get; set; }
    public String templateId { get; set; }
    public String contactId { get; set; }
    public String proposalRecipientId { get; set; }
    public String customerAcceptedDate { get; set; }
    public Boolean customSignature { get; set; }
    public wfrecon__Proposal_Recipient__c proRecRecord { get; set; }
    public String objectAPIName { get; set; }
    public String rejectionReason { get; set; }
    public String requestedChanges { get; set; }
    public String cdId { get; set; }
    public Boolean displayPopup { get; set; }
    public String quoteMessage { get; set; }
    public Boolean isAccepted { get; set; }
    public String result { get; set; }
    public transient String signatureData { get; set; }
    public Boolean isExpired { get; set; }
    public transient String strBody { get; set; }
    public String proposalStatus { get; set; }

    public void createPDF() {
        try {
            isAccepted = false;
            customSignature = false;
            displayPopup = false;
            isExpired = false;
            result = 'Not Accepted';
            proposalStatus = 'Pending';
            proRecRecord = new wfrecon__Proposal_Recipient__c();
            recordId = ApexPages.currentPage().getParameters().get('recordId')?.escapeHtml4();
            templateId = ApexPages.currentPage().getParameters().get('templateId')?.escapeHtml4();
            contactId = ApexPages.currentPage().getParameters().get('contactId')?.escapeHtml4();

            if (String.isBlank(recordId)) {
                quoteMessage = 'Error: Proposal ID is missing.';
                strBody = null;
                return;
            }
            if (String.isBlank(templateId)) {
                quoteMessage = 'Error: Template ID is missing.';
                strBody = null;
                return;
            }
            if (String.isBlank(contactId)) {
                quoteMessage = 'Error: Contact ID is missing.';
                strBody = null;
                return;
            }

            List<wfrecon__Proposal_Recipient__c> proposalRecipients = [SELECT Id, Name, wfrecon__Accepted_Rejected_Changed_Date__c, wfrecon__Contact__c, wfrecon__Due_Date__c, wfrecon__Proposal__c, 
                                                                        wfrecon__Proposal__r.Name, wfrecon__Requested_Changes__c, wfrecon__Status__c
                                                                        FROM wfrecon__Proposal_Recipient__c
                                                                        WHERE wfrecon__Proposal__c = :recordId AND wfrecon__Contact__c = :contactId ORDER BY CreatedDate DESC
                                                                        LIMIT 1];

            if (proposalRecipients == null || proposalRecipients.isEmpty()) {
                quoteMessage = 'Error: No valid proposal found.';
                strBody = null;
                return;
            } else {
                proRecRecord = proposalRecipients[0];
                proposalRecipientId = proRecRecord.Id;
            }

            if (proRecRecord.wfrecon__Status__c == 'Accepted') {
                quoteMessage = 'This Proposal has already been Accepted, please contact your Sales Representative with any questions.';
                isAccepted = true;
                result = 'Accepted';
                proposalStatus = 'Accepted';
                strBody = 'Proposal: ' + proRecRecord.wfrecon__Proposal__r.Name + '<br/>Status: Accepted on ' + (proRecRecord.wfrecon__Accepted_Rejected_Changed_Date__c?.format() ?? 'N/A');
                return;
            } else if (proRecRecord.wfrecon__Status__c == 'Rejected') {
                quoteMessage = 'This Proposal has already been Rejected, please contact your Sales Representative with any questions.';
                result = 'Rejected';
                proposalStatus = 'Rejected';
                strBody = 'Proposal: ' + proRecRecord.wfrecon__Proposal__r.Name + '<br/>Status: Rejected';
                return;
            } else if (proRecRecord.wfrecon__Status__c == 'Changes Requested') {
                quoteMessage = 'Changes have already been requested for this Proposal. Your Sales Representative will contact you soon.';
                result = 'Changes Requested';
                proposalStatus = 'Changes Requested';
                strBody = 'Proposal: ' + proRecRecord.wfrecon__Proposal__r.Name + '<br/>Status: Changes Requested';
                return;
            } else if (proRecRecord.wfrecon__Due_Date__c != null && proRecRecord.wfrecon__Due_Date__c < Date.today()) {
                quoteMessage = 'This Proposal has expired as the due date (' + proRecRecord.wfrecon__Due_Date__c.format() + ') has passed. Please contact your Sales Representative for further assistance.';
                isExpired = true;
                result = 'Expired';
                proposalStatus = 'Expired';
                strBody = 'Proposal: ' + proRecRecord.wfrecon__Proposal__r.Name + '<br/>Status: Expired on ' + proRecRecord.wfrecon__Due_Date__c.format();
                return;
            }

            Savepoint sp = Database.setSavepoint();
            Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
            email.setTemplateId(templateId);
            email.setWhatId(recordId);
            email.setTargetObjectId(contactId);
            email.setSaveAsActivity(false);
            email.setToAddresses(new List<String>{'dummy@example.com'});

            Messaging.SendEmailResult[] results = Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{email});
            Database.rollback(sp);

            if (!results.isEmpty() && results[0].isSuccess()) {
                strBody = email.getHTMLBody();
                if (String.isBlank(strBody)) {
                    quoteMessage = 'Error: Email template content is empty.';
                    strBody = null;
                }
            } else {
                String errorMessage = results.isEmpty() ? 'No results returned' : String.valueOf(results[0].getErrors());
                strBody = null;
                quoteMessage = 'Error: Failed to generate proposal content.';
            }
        } catch (Exception e) {
            strBody = null;
            quoteMessage = 'Error: Unable to load proposal. ' + e.getMessage();
        }
    }

    public void showRejectReasonPopup() {
        displayPopup = true;
    }

    public void closeRejectReason() {
        displayPopup = false;
    }

    public void saveRejectionReason() {
        try {
            displayPopup = false;

            wfrecon__Proposal_Recipient__c proposalRec = new wfrecon__Proposal_Recipient__c(
                Id = proposalRecipientId,
                wfrecon__Accepted_Rejected_Changed_Date__c = System.today(),
                wfrecon__Status__c = 'Rejected',
                wfrecon__Requested_Changes__c = rejectionReason
            );
            update proposalRec;

            customSignature = true;
            proposalStatus = 'Rejected';
            result = 'Rejected';
            quoteMessage = 'You have rejected the Proposal. Please contact your Sales Representative for further assistance.';
            strBody = 'Proposal: ' + proRecRecord.wfrecon__Proposal__r.Name + '<br/>Status: Rejected';
        } catch (Exception e) {
            quoteMessage = 'Error saving rejection: ' + e.getMessage();
            strBody = null;
        }
    }

    public void saveRequestChanges() {
        try {
            displayPopup = false;
            if (String.isBlank(requestedChanges)) {
                quoteMessage = 'Error: No requested changes provided.';
                strBody = null;
                return;
            }

            wfrecon__Proposal_Recipient__c proposalRec = new wfrecon__Proposal_Recipient__c(
                Id = proposalRecipientId,
                wfrecon__Accepted_Rejected_Changed_Date__c = System.today(),
                wfrecon__Status__c = 'Changes Requested',
                wfrecon__Requested_Changes__c = requestedChanges
            );
            update proposalRec;

            customSignature = true;
            proposalStatus = 'Changes Requested';
            result = 'Changes Requested';
            quoteMessage = 'Your change request has been submitted. Your Sales Representative will contact you soon.';
            strBody = 'Proposal: ' + proRecRecord.wfrecon__Proposal__r.Name + '<br/>Status: Changes Requested<br/>Requested Changes: ' + requestedChanges;
        } catch (Exception e) {
            quoteMessage = 'Error saving change request: ' + e.getMessage();
            strBody = null;
        }
    }

    public PageReference uploadSignature() {
        try {
            if (String.isBlank(signatureData)) {
                quoteMessage = 'Error: No signature provided.';
                strBody = null;
                return null;
            }

            Date nowDT = Date.today();
            customerAcceptedDate = String.valueOf(DateTime.now());

            ContentVersion conVer = new ContentVersion();
            conVer.ContentLocation = 'S';
            conVer.PathOnClient = 'SignatureName.png';
            conVer.Title = 'Signature ' + nowDT;
            conVer.VersionData = EncodingUtil.base64Decode(signatureData);
            insert conVer;

            Id conDoc = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :conVer.Id].ContentDocumentId;
            ContentDocumentLink conDocLink = new ContentDocumentLink();
            conDocLink.LinkedEntityId = proposalRecipientId;
            conDocLink.ContentDocumentId = conDoc;
            conDocLink.shareType = 'I';
            conDocLink.Visibility = 'AllUsers';
            insert conDocLink;

            ContentDistribution cd = new ContentDistribution();
            cd.Name = 'Proposal Signature ' + nowDT;
            cd.ContentVersionId = conVer.Id;
            cd.PreferencesAllowOriginalDownload = true;
            cd.PreferencesAllowPDFDownload = true;
            cd.PreferencesAllowViewInBrowser = true;
            cd.PreferencesNotifyOnVisit = false;
            insert cd;
            
            cdId = cd.Id;

            wfrecon__Proposal_Recipient__c proposalRec = new wfrecon__Proposal_Recipient__c(
                Id = proposalRecipientId,
                wfrecon__Accepted_Rejected_Changed_Date__c = Datetime.now(),
                wfrecon__Status__c = 'Accepted'
            );
            update proposalRec;

            customSignature = true;
            proposalStatus = 'Accepted';
            result = 'Accepted';
            quoteMessage = 'You have successfully signed and accepted your Proposal. Thank you for your business.';
            strBody = 'Proposal: ' + proRecRecord.wfrecon__Proposal__r.Name + '<br/>Status: Accepted on ' + Datetime.now().format();

            return null;
        } catch (Exception e) {
            quoteMessage = 'Error saving signature: ' + e.getMessage();
            strBody = null;
            return null;
        }
    }

    public PageReference insertAttachment() {
        try {
            if (String.isBlank(cdId)) {
                quoteMessage = 'Error: No signature distribution found.';
                strBody = null;
                return null;
            }

            ContentDistribution cdPublicLink = [SELECT Id, DistributionPublicUrl, ContentDownloadUrl FROM ContentDistribution WHERE Id = :cdId LIMIT 1];
            if (cdPublicLink == null) {
                quoteMessage = 'Error: Failed to retrieve signature distribution link.';
                strBody = null;
                return null;
            }

            PageReference pdfPage = Page.ProposalPageAsPDF;
            pdfPage.getParameters().put('Id', recordID);
            pdfPage.getParameters().put('imgURL', cdPublicLink.ContentDownloadUrl);
            pdfPage.getParameters().put('customerAcceptedDate', customerAcceptedDate);
            pdfPage.getParameters().put('templateId', templateId);
            pdfPage.getParameters().put('contactId', contactId);

            Blob pdfBlob = Test.isRunningTest() ? Blob.valueOf('Unit.Test') : pdfPage.getContent();

            ContentVersion conVer = new ContentVersion();
            conVer.ContentLocation = 'S';
            conVer.PathOnClient = 'Proposal.pdf';
            conVer.Title = 'Proposal ' + Datetime.valueOf(customerAcceptedDate).format('MM-dd-yyyy HH:mm:ss') + '.pdf';
            conVer.VersionData = pdfBlob;
            insert conVer;

            Id conDoc = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :conVer.Id].ContentDocumentId;
            ContentDocumentLink conDocLink = new ContentDocumentLink();
            conDocLink.LinkedEntityId = proposalRecipientId;
            conDocLink.ContentDocumentId = conDoc;
            conDocLink.shareType = 'I';
            conDocLink.Visibility = 'AllUsers';
            insert conDocLink;

            customSignature = true;
            proposalStatus = 'Accepted';
            quoteMessage = 'You have successfully signed and accepted your Proposal. Thank you for your business.';
            strBody = 'Proposal: ' + proRecRecord.wfrecon__Proposal__r.Name + '<br/>Status: Accepted on ' + Datetime.valueOf(customerAcceptedDate).format('MM-dd-yyyy HH:mm:ss');
            return null;
        } catch (Exception e) {
            quoteMessage = 'Error generating PDF: ' + e.getMessage();
            strBody = null;
            return null;
        }
    }
}
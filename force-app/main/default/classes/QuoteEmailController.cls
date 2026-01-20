public with sharing class QuoteEmailController {

    public class InitData {
        @AuraEnabled public List<OrgWideEmailAddress> orgWideAddresses;
        @AuraEnabled public List<EmailTemplate> emailTemplates;
        @AuraEnabled public String baseUrl;
        @AuraEnabled public String defaultContactId;
    }

    @AuraEnabled(cacheable=true)
    public static InitData getInitialData(String recordId) {
        try {
            InitData data = new InitData();
            data.orgWideAddresses = [SELECT Id, Address, DisplayName FROM OrgWideEmailAddress WITH USER_MODE];
            data.emailTemplates = [
                SELECT Id, Name 
                FROM EmailTemplate 
                WHERE IsActive = true 
                AND Folder.Name = 'Quote Emails' WITH USER_MODE
                ORDER BY Name 
                LIMIT 100
            ];
            
            // Fetch Base URL from Custom Setting (Quote_Settings__c)
            wfrecon__Proposal_Settings__c settings = wfrecon__Proposal_Settings__c.getOrgDefaults();
            if(settings != null && settings.wfrecon__Base_URL__c != null) {
                data.baseUrl = settings.wfrecon__Base_URL__c;
            } else {
                // Fallback or empty if not set
                data.baseUrl = '';
            }
            

            // Auto-fetch Contact ID from Proposal -> Bid -> Contact
            if (String.isNotBlank(recordId)) {
                try {
                    // Query wfrecon__Contact__c directly from the Proposal
                    List<wfrecon__Proposal__c> proposal = [
                        SELECT wfrecon__Contact__c 
                        FROM wfrecon__Proposal__c 
                        WHERE Id = :recordId 
                        WITH USER_MODE
                        LIMIT 1
                    ];

                    if (proposal[0].wfrecon__Contact__c != null) {
                        data.defaultContactId = proposal[0].wfrecon__Contact__c;
                    }
                } catch (Exception e) {
                    System.debug('Error fetching default contact: ' + e.getMessage());
                }
            }
            
            return data;
        } catch (Exception e) {
            System.debug('Exception in getInitialData: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'QuoteEmailController', 'methodName' => 'getInitialData', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    @AuraEnabled
    public static String getContactName(String contactId) {
        if(String.isBlank(contactId)) return '';
        try {
            Contact c = [SELECT Name FROM Contact WHERE Id = :contactId WITH USER_MODE LIMIT 1];
            return c.Name;
        } catch(Exception e) {
            return '';
        }
    }

    @AuraEnabled
    public static Map<String, String> renderEmailTemplate(String templateId, String whoId, String whatId) {
        try {
        if(String.isBlank(templateId)) return null;

        if(String.isBlank(whoId)) {
            List<Contact> dummy = [SELECT Id FROM Contact WITH USER_MODE LIMIT 1];
            if(!dummy.isEmpty()) whoId = dummy[0].Id;
        }

            Messaging.SingleEmailMessage mail = Messaging.renderStoredEmailTemplate(templateId, whoId, whatId);
            Map<String, String> result = new Map<String, String>();
            result.put('subject', mail.getSubject());
            result.put('body', mail.getHtmlBody());
            return result;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'QuoteEmailController', 'methodName' => 'renderEmailTemplate', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    /**
     * Updated to accept file attachments
     * files parameter structure: List of Maps { 'fileName': '...', 'base64Data': '...', 'contentType': '...' }
     */
    @AuraEnabled
    public static void sendQuoteEmail(
        String toId, 
        List<String> ccIds, 
        List<String> bccIds, 
        String subject, 
        String body, 
        String fromId, 
        String relatedToId,
        List<String> contentDocumentIds,
        String templateId
    ) {
        try {

            System.debug('sendQuoteEmail called with templateId: ' + templateId +
                         ' toId: ' + toId +
                         ' relatedToId: ' + relatedToId +
                         ' fromId: ' + fromId +
                         ' ccIds: ' + ccIds +
                         ' bccIds: ' + bccIds +
                         ' contentDocumentIds: ' + contentDocumentIds);

            // 1. Insert Recipient Logic
            if(String.isNotBlank(toId) && String.isNotBlank(relatedToId)) {
                wfrecon__Proposal_Recipient__c recipient = new wfrecon__Proposal_Recipient__c();
                recipient.wfrecon__Proposal__c = relatedToId;
                recipient.wfrecon__Contact__c = toId;
                recipient.wfrecon__Status__c = 'Pending';
                insert as user recipient;
            }

            // 3. Prepare Email
            Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
            
            if(String.isNotBlank(toId)) {
                mail.setTargetObjectId(toId);
                mail.setTreatTargetObjectAsRecipient(true);
            }

            if(String.isNotBlank(relatedToId)) {
                mail.setWhatId(relatedToId);
            }

            if(String.isNotBlank(fromId)) {
                mail.setOrgWideEmailAddressId(fromId);
            }

            if(ccIds != null && !ccIds.isEmpty()) {
                mail.setCcAddresses(getEmailsFromIds(ccIds));
            }
            if(bccIds != null && !bccIds.isEmpty()) {
                mail.setBccAddresses(getEmailsFromIds(bccIds));
            }

            mail.setSubject(subject);
            mail.setHtmlBody(body);
            mail.setSaveAsActivity(true);

            // 3. GENERATE PDF USING REFERENCE CODE LOGIC
            // We call the Visualforce Page SendProposalPageAsPDF which runs the rollback logic
            if(String.isNotBlank(relatedToId) && String.isNotBlank(templateId)) {
                
                PageReference pdfPage = Page.SendProposalPageAsPDF;
                pdfPage.getParameters().put('recordId', relatedToId);
                pdfPage.getParameters().put('templateId', templateId);
                if(String.isNotBlank(toId)) {
                    pdfPage.getParameters().put('contactId', toId);
                }

                Blob pdfBlob;
                if(Test.isRunningTest()) {
                    pdfBlob = Blob.valueOf('Test PDF Content');
                } else {
                    // This triggers the createPDF action in SendProposalPageAsPDFController
                    pdfBlob = pdfPage.getContentAsPDF(); 
                }

                Messaging.EmailFileAttachment pdfAtt = new Messaging.EmailFileAttachment();
                pdfAtt.setFileName('Proposal.pdf');
                pdfAtt.setBody(pdfBlob);
                pdfAtt.setContentType('application/pdf');
                
                mail.setFileAttachments(new Messaging.EmailFileAttachment[] { pdfAtt });
            }

            // 4. Handle Existing Files
            if (contentDocumentIds != null && !contentDocumentIds.isEmpty()) {
                List<ContentVersion> versions = [
                    SELECT Id 
                    FROM ContentVersion 
                    WHERE ContentDocumentId IN :contentDocumentIds 
                    AND IsLatest = true
                    WITH USER_MODE
                ];
                List<Id> entityAttachments = new List<Id>();
                for(ContentVersion cv : versions) {
                    entityAttachments.add(cv.Id);
                }
                mail.setEntityAttachments(entityAttachments);
            }

            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{mail});

            // Update status of proposal to "Submitted"
            if (String.isNotBlank(relatedToId)) {
                wfrecon__Proposal__c proposalToUpdate = new wfrecon__Proposal__c();
                proposalToUpdate.Id = relatedToId;
                proposalToUpdate.wfrecon__Status__c = 'Submitted';
                update as user proposalToUpdate;
            }

        } catch (Exception e) {
            System.debug('Exception in sendQuoteEmail: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'QuoteEmailController', 'methodName' => 'sendQuoteEmail', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
        }
    }

    /**
     * Deletes files (used when user removes a newly uploaded file)
     */
    @AuraEnabled
    public static void deleteContentDocuments(List<String> contentDocumentIds) {
        try {
            if (contentDocumentIds == null || contentDocumentIds.isEmpty()) return;
            delete [SELECT Id FROM ContentDocument WHERE Id IN :contentDocumentIds WITH USER_MODE];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'QuoteEmailController', 'methodName' => 'deleteContentDocuments', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
        }
    }

    /**
     * Fetches details (including size) for newly uploaded files to validate
     */
    @AuraEnabled
    public static List<FileWrapper> getUploadedFileDetails(List<String> contentDocumentIds) {
        try {
            List<FileWrapper> fileList = new List<FileWrapper>();
            List<ContentDocument> docs = [
                SELECT Id, Title, FileExtension, LatestPublishedVersionId, ContentSize
                FROM ContentDocument 
                WHERE Id IN :contentDocumentIds
            ];

            for(ContentDocument doc : docs) {
                FileWrapper fw = new FileWrapper();
                fw.docId = doc.Id;
                fw.versionId = doc.LatestPublishedVersionId;
                fw.title = doc.Title;
                fw.extension = doc.FileExtension;
                fw.size = doc.ContentSize;
                if(doc.FileExtension != null){
                    fw.isImage = true;
                } else {
                    fw.isImage = false;
                }
                fileList.add(fw);
            }
            return fileList;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'QuoteEmailController', 'methodName' => 'getUploadedFileDetails', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return new List<FileWrapper>();
        }
    }

    /**
     * Fetches existing files linked to the record for the "Select Existing" modal
     */
    @AuraEnabled
    public static List<FileWrapper> getRecordFiles(String recordId) {
        try {
            List<FileWrapper> fileList = new List<FileWrapper>();
            List<ContentDocumentLink> links = [
                SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.FileExtension, ContentDocument.LatestPublishedVersionId, ContentDocument.ContentSize
                FROM ContentDocumentLink 
                WHERE LinkedEntityId = :recordId
                ORDER BY ContentDocument.CreatedDate DESC
            ];

            for(ContentDocumentLink link : links) {
                FileWrapper fw = new FileWrapper();
                fw.docId = link.ContentDocumentId;
                fw.versionId = link.ContentDocument.LatestPublishedVersionId;
                fw.title = link.ContentDocument.Title;
                fw.extension = link.ContentDocument.FileExtension;
                fw.size = link.ContentDocument.ContentSize;
                if(link.ContentDocument.FileExtension != null){
                    fw.isImage = true;
                } else {
                    fw.isImage = false;
                }
                fileList.add(fw);
            }
            return fileList;
        } catch (Exception e) {
            return new List<FileWrapper>();
        }
    }

    private static List<String> getEmailsFromIds(List<String> recordIds) {
        try {
            List<String> emails = new List<String>();
            for(Contact c : [SELECT Email FROM Contact WHERE Id IN :recordIds WITH USER_MODE]) {
                if(c.Email != null) emails.add(c.Email);
            }
            return emails;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'QuoteEmailController', 'methodName' => 'getEmailsFromIds', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return new List<String>();
        }
    }

    // UPDATED METHOD: Get ALL Contract Lines (Base + Alternate) for the Wizard Step 1
    @AuraEnabled
    public static List<wfrecon__Proposal_Line__c> getProposalLines(String recordId) {
        return [
            SELECT Id, Name, wfrecon__Description__c, wfrecon__Total_Cost__c, 
                   wfrecon__Quantity__c, wfrecon__Sales_Price__c, wfrecon__Type__c,
                   wfrecon__Selected__c, wfrecon__Sequence__c,wfrecon__Unit_Price__c
            FROM wfrecon__Proposal_Line__c
            WHERE wfrecon__Proposal__c = :recordId
            ORDER BY wfrecon__Sequence__c ASC
        ];
    }

    // NEW METHOD: Update the checkbox on records based on user selection
    @AuraEnabled
    public static void updateLineSelection(List<String> selectedIds, String recordId) {
        try {
            // Fetch ALL lines for this Proposal
            List<wfrecon__Proposal_Line__c> allLines = [
                SELECT Id, wfrecon__Selected__c 
                FROM wfrecon__Proposal_Line__c 
                WHERE wfrecon__Proposal__c = :recordId
                WITH USER_MODE
            ];

            List<wfrecon__Proposal_Line__c> linesToUpdate = new List<wfrecon__Proposal_Line__c>();
            Set<String> selectedSet = new Set<String>(selectedIds);

            for(wfrecon__Proposal_Line__c line : allLines) {
                Boolean shouldBeSelected = selectedSet.contains(line.Id);
                // Only add to update list if value changes
                if(line.wfrecon__Selected__c != shouldBeSelected) {
                    line.wfrecon__Selected__c = shouldBeSelected;
                    linesToUpdate.add(line);
                }
            }

            if(!linesToUpdate.isEmpty()) {
                update as user linesToUpdate;
            }
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    public class FileWrapper {
        @AuraEnabled public String docId;
        @AuraEnabled public String versionId;
        @AuraEnabled public String title;
        @AuraEnabled public String extension;
        @AuraEnabled public Boolean isImage;
        @AuraEnabled public Long size;
    }
}
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
            data.orgWideAddresses = [SELECT Id, Address, DisplayName FROM OrgWideEmailAddress];
            data.emailTemplates = [
                SELECT Id, Name 
                FROM EmailTemplate 
                WHERE IsActive = true 
                AND Folder.Name = 'Quote Emails' 
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
                    // Fetch Proposal to get Contact ID via Bid
                    List<wfrecon__Proposal__c> proposals = [
                        SELECT wfrecon__Bid__r.wfrecon__Contact__c 
                        FROM wfrecon__Proposal__c 
                        WHERE Id = :recordId 
                        with user_mode
                        LIMIT 1
                    ];

                    if (!proposals.isEmpty() && proposals[0].wfrecon__Bid__r != null && proposals[0].wfrecon__Bid__r.wfrecon__Contact__c != null) {
                        data.defaultContactId = proposals[0].wfrecon__Bid__r.wfrecon__Contact__c;
                    }
                } catch (Exception e) {
                    // Fail silently for auto-population logic if fields don't exist or permissions issue
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
            Contact c = [SELECT Name FROM Contact WHERE Id = :contactId with user_mode LIMIT 1];
            return c.Name;
        } catch(Exception e) {
            System.debug('Exception in getContactName: ' + e.getMessage());
            return '';
        }
    }

    @AuraEnabled
    public static Map<String, String> renderEmailTemplate(String templateId, String whoId, String whatId) {
        if(String.isBlank(templateId)) return null;

        if(String.isBlank(whoId)) {
            List<Contact> dummy = [SELECT Id FROM Contact with user_mode LIMIT 1];
            if(!dummy.isEmpty()) whoId = dummy[0].Id;
        }

        try {
            Messaging.SingleEmailMessage mail = Messaging.renderStoredEmailTemplate(templateId, whoId, whatId);
            Map<String, String> result = new Map<String, String>();
            result.put('subject', mail.getSubject());
            result.put('body', mail.getHtmlBody());
            return result;
        } catch (Exception e) {
            System.debug('Exception in renderEmailTemplate: ' + e.getMessage());
            throw new AuraHandledException('Error rendering template: ' + e.getMessage());
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
        List<String> contentDocumentIds 
    ) {
        try {
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

            // --- Handle Attachments (Salesforce Files) ---
            if (contentDocumentIds != null && !contentDocumentIds.isEmpty()) {
                // We need ContentVersion IDs to attach to email
                // Querying LatestPublishedVersionId ensures we get the actual file blob reference
                List<ContentVersion> versions = [
                    SELECT Id 
                    FROM ContentVersion 
                    WHERE ContentDocumentId IN :contentDocumentIds 
                    AND IsLatest = true
                ];
                List<Id> entityAttachments = new List<Id>();
                for(ContentVersion cv : versions) {
                    entityAttachments.add(cv.Id);
                }
                mail.setEntityAttachments(entityAttachments);
            }

            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{mail});

        } catch (Exception e) {
            System.debug('Exception in sendQuoteEmail: ' + e.getMessage());
            throw new AuraHandledException('Error sending email: ' + e.getMessage());
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
            System.debug('Exception in deleteContentDocuments: ' + e.getMessage());
            throw new AuraHandledException('Error deleting files: ' + e.getMessage());
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
                
                Set<String> imgExts = new Set<String>{'jpg','jpeg','png','gif'};
                if(doc.FileExtension != null && imgExts.contains(doc.FileExtension.toLowerCase())){
                    fw.isImage = true;
                } else {
                    fw.isImage = false;
                }
                fileList.add(fw);
            }
            return fileList;
        } catch (Exception e) {
            System.debug('Exception in getUploadedFileDetails: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
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
                // Simple logic to detect images
                Set<String> imgExts = new Set<String>{'jpg','jpeg','png','gif'};
                if(link.ContentDocument.FileExtension != null && imgExts.contains(link.ContentDocument.FileExtension.toLowerCase())){
                    fw.isImage = true;
                } else {
                    fw.isImage = false;
                }
                fileList.add(fw);
            }
            return fileList;
        } catch (Exception e) {
            System.debug('Exception in getRecordFiles: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
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
            System.debug('Exception in getEmailsFromIds: ' + e.getMessage());
            return new List<String>();
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
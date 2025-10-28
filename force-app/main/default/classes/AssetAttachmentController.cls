public with sharing class AssetAttachmentController {
    @AuraEnabled
    public static List<ContantDoc> getContents(Id jobID, Integer fatchedRecordNo) {
        Map<Id, ContantDoc> ContactDocumentMap = new Map<Id, ContantDoc>();
        
        String soql = 'SELECT Id, ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :arg1'+
            ' WITH SECURITY_ENFORCED ORDER BY Id DESC LIMIT 1';
        ContentDocumentLink[] contentDocLinks = Lib_Security.ws().dbQuery(soql, new Object[]{jobID});
        for (ContentDocumentLink cdl : contentDocLinks) {
            ContactDocumentMap.put(cdl.ContentDocumentId, new ContantDoc(null, cdl.ContentDocumentId));
        }
        return ContactDocumentMap.values();
    }
    
    public class ContantDoc {
        @AuraEnabled
        public String name;
        @AuraEnabled
        public String fileId;
        
        public ContantDoc(String Name, String fileId) {
            this.name = Name;
            this.fileId = fileId;
        }
    }
}
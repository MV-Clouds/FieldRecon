public with sharing class ProfilePictureController {
    @AuraEnabled
    public static Document getProfilePicture() {
            String soql = 'SELECT Id, Name, Body, ContentType, CreatedDate FROM Document '+
                    'WITH SECURITY_ENFORCED ORDER BY CreatedDate DESC LIMIT 1';
            Document[] doc = Lib_Security.ws().dbQuery(soql, new Object[]{});
            return doc[0];
        
    }

    @AuraEnabled
    public static Id saveAttachment(String fileName, String base64Data, String contentType) {
        
            Document docu = new Document();
            String soql = 'SELECT Id, Name FROM Folder WITH SECURITY_ENFORCED ORDER BY CreatedDate DESC LIMIT 1';
            Folder[] docIds = Lib_Security.ws().dbQuery(soql, new Object[]{});
            docu.FolderId = docIds[0].Id;
            docu.Body = EncodingUtil.base64Decode(base64Data);
            docu.Name = fileName;
            docu.ContentType = contentType;
            Lib_Security.ws().dbInsert(new Document[]{docu});
            return docu.id;
    }
}
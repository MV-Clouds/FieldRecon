public with sharing class Util {
    public static String userId = UserInfo.getUserId();
    public static String UserProfileId = UserInfo.getProfileId(); // Crew : '00e4P000001EujXQAS'; Superviser : '00e4P000001EujDQAS'; // Default : UserInfo.getProfileId();
    public static String UserRole = UserInfo.getUserRoleId();
    private static Id contactId;
    // We only want to query the contact once to prevent query limits
    private static Boolean queriedForContactId = false;

    // caching values so we are not quering multiple times
    private static Map<String, AccessWrapper> accessMap = new Map<String, AccessWrapper>();

    public static String getNamespace() {
        return Util.class.getName().substringBefore('Util').substringBefore('.');
    }

    public static String getNamespaceWithUnderscore() {
        String namespace = getNamespace();
        return String.isNotBlank(namespace) ? getNamespace() + '__' : '';
    }

    public static Boolean isNamespaced() {
        return String.isNotEmpty(getNamespace());
    }

    public static String componentNamespace() {
        String namespace = getNamespace();
        return String.isNotBlank(namespace) ? getNamespace() : 'c';
    }

    public static Boolean secondLevelFeatureAccess(){
        return System.FeatureManagement.checkPackageBooleanValue('Level_II_User') || thirdLevelFeatureAccess();
    }

    public static Boolean thirdLevelFeatureAccess(){
        return System.FeatureManagement.checkPackageBooleanValue('Level_III_User');
    }

    public static Id getUserContactId() {
        if (contactId == null && queriedForContactId == false) {
            String soql = 'SELECT Id FROM Contact WHERE User__c = :arg1 WITH SECURITY_ENFORCED';

            List<Contact> contacts = Lib_Security.ws().dbQuery(soql, new List<Object>{ UserInfo.getUserId() });
            if (contacts.size() > 0) {
                contactId = contacts[0].Id;
            }

            queriedForContactId = true;
        }
        return contactId;
    }

    public static List<String> getListtoSet(List<String> listOfData) {
        Set<String> setOfData = new Set<String>();
        for (Integer i = 0; i < listOfData.size(); i++) {
            setOfData.add(listOfData[i]);
        }
        listOfData = new List<String>();
        listOfData.addAll(setOfData);
        return listOfData == null ? listOfData = new List<String>() : listOfData;
    }

    public static accessWrapper checkAccess(String objName) {
        String objectName = Util.getNamespaceWithUnderscore() + objName;

        SObjectType sobjectType = Schema.getGlobalDescribe().get(objectName);

        Schema.DescribeSObjectResult dsr = sobjectType.getDescribe();

        accessWrapper aw = new accessWrapper();

        aw.CreateFlag = dsr.isCreateable();
        aw.EditFlag = dsr.isUpdateable();
        aw.DeleteFlag = dsr.isDeletable();
        aw.ReadFlag = dsr.isAccessible();

        aw.UserId = userId;
        aw.contactId = getUserContactId();
        accessMap.put(objectName, aw);
        System.debug(accessMap);
        return aw;
    }

    public static Integer getUserOffset() {
        return UserInfo.getTimezone().getOffset(Datetime.now());
    }

    // To query from any object.
    public static String getQueryData(String ObjectName, String relatedFields) {
        String query = 'SELECT ' + util.getDynamicFields(ObjectName, '');
        query = query.replace('LastViewedDate ,', '');
        query = query.replace('LastReferencedDate ,', '');
        System.debug(query);
        // If we have any parent fields to query pass in string format with comma seperated.
        if (relatedFields != '')
            query += relatedFields;
        query += ' FROM ' + ObjectName;

        return query;
    }

    //To get all parent records dynamic
    public static string getParentRecordFields(String ObjectName) {
        return ' , ' +
            Util.getDynamicFields(
                ObjectName,
                Util.getNamespaceWithUnderscore() +
                ObjectName.removeEnd('c') +
                (ObjectName.endsWith('c') ? 'r.' : '.')
            );
    }

    // returns object's field names without parent fields.
    public static String getDynamicFields(String ObjectName, String ParentObj) {
        String fieldNames = '';
        String objName = ObjectName.endsWith('__c') == true
            ? Util.getNamespaceWithUnderscore() + ObjectName
            : ObjectName;
        Schema.SObjectType convertType = Schema.getGlobalDescribe().get(objName);
        Map<String, Schema.SObjectField> fieldsMap = convertType.getDescribe().fields.getMap();
        Boolean isFirst = true;
        for (String key : fieldsMap.keySet()) {
            fieldNames = isFirst
                ? fieldNames + ' ' + ParentObj + fieldsMap.get(key)
                : fieldNames + ', ' + ParentObj + fieldsMap.get(key) + ' ';
            isFirst = false;
        }
        return fieldNames;
    }

    // Returns list of picklist values.
    public static List<String> getPickListValues(String ObjName, String FieldName) {
        String[] values = new List<String>{};
        String[] types = new List<String>{ Util.getNamespaceWithUnderscore() + ObjName };
        Schema.DescribeSobjectResult[] results = Schema.describeSObjects(types);

        for (Schema.DescribeSobjectResult res : results) {
            for (
                Schema.PicklistEntry entry : res.fields.getMap()
                    .get(Util.getNamespaceWithUnderscore() + FieldName)
                    .getDescribe()
                    .getPicklistValues()
            ) {
                if (entry.isActive()) {
                    values.add(entry.getValue());
                }
            }
        }
        return values;
    }

    public class accessWrapper {
        @AuraEnabled
        public String UserId = '';
        @AuraEnabled
        public String ContactId = '';
        @AuraEnabled
        public Boolean ReadFlag = false;
        @AuraEnabled
        public Boolean EditFlag = false;
        @AuraEnabled
        public Boolean CreateFlag = false;
        @AuraEnabled
        public Boolean DeleteFlag = false;
    }
}
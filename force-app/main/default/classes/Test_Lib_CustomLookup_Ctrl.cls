@isTest
public class Test_Lib_CustomLookup_Ctrl {
    @testSetup static void setup(){
    	TestDataFactory.contactDataWithRecordtype(1);
    }
	@isTest
    public static void testfetchLookUpValues() {
        Test.startTest();
        	List<sobject> results = Lib_CustomLookup_Ctrl.fetchLookUpValues('','Contact','Name',null);
        Test.stopTest();
        for(Contact temp : (List<Contact>)results) {
            System.assertEquals('TEst', temp.Name);
        }
    }
    @isTest
    public static void testgetRecordName() {
        Contact c = [SELECT Id from Contact][0];
        Test.startTest();
        	SObject result = Lib_CustomLookup_Ctrl.getRecordName((String) c.Id,'Contact');
        Test.stopTest();
        c = (Contact) result;
        System.assertEquals('TEst', c.Name);
    }
    @isTest
    public static void testfetchLookUpValuesWithFilter() {
        Test.startTest();
        	List<sobject> results = Lib_CustomLookup_Ctrl.fetchLookUpValues('','Contact','Name','TimeSheetReport_UserSOQLFilter');
        Test.stopTest();
        for(Contact temp : (List<Contact>)results) {
            System.assertEquals('TEst', temp.Name);
        }
    }
    @isTest
    public static void testLookupCollections() {
        Test.startTest();
        Set<String> str = new Set<String>{'Test','Record','Timesheet','Card'};
        String res = Lib_Collections.toCSV(str);
        System.assertNotEquals(null,res);
        System.assertEquals(true,res.contains(','));
        Test.stopTest();
    }
}
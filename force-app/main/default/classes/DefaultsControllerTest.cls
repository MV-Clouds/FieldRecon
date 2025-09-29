@isTest
public with sharing class DefaultsControllerTest {
    private class WebServiceMockImpl implements WebServiceMock {
        public void doInvoke(
          Object stub, Object request, Map<String, Object> response,
          String endpoint, String soapAction, String requestName,
          String responseNS, String responseName, String responseType) {
          if(request instanceof MetadataService.readMetadata_element){
            MetadataService.readMetadata_element requestReadMetadata_element  = 
                  (MetadataService.readMetadata_element) request;
            // This allows you to generalize the mock response by type of metadata read
            if (requestReadMetadata_element.type_x == 'GlobalValueSet') { 
               MetadataService.readGlobalValueSetResponse_element mockRes   = 
                    new MetadataService.readGlobalValueSetResponse_element();
               mockRes.result = new MetaDataService.ReadGlobalValueSetResult();
               WebServiceMockImpl testInstance = new WebServiceMockImpl();
               mockRes.result.records = testInstance.createGlobalValueSet();
               response.put('response_x', mockRes);
            }
         }
         else if (request instanceof MetadataService.updateMetadata_element) {
          // mock the updateMetadata() response 
          // mock your customField results}
          MetadataService.updateMetadataResponse_element mockRes = new MetadataService.updateMetadataResponse_element();
          MetadataService.SaveResult resultOfUpdate = new MetadataService.SaveResult();
          resultOfUpdate.success = true;
          mockRes.result = new List<MetadataService.SaveResult> {resultOfUpdate};
          response.put('response_x', mockRes);
         }
         // else if (...) any other response you have to mock
         return;
       }
       public List<MetadataService.GlobalValueSet> createGlobalValueSet() {
        MetadataService.GlobalValueSet testValues  = new MetadataService.GlobalValueSet();
        testValues.fullName = 'Mobilization_Status';
        MetadataService.CustomValue testCustomValues = new MetadataService.CustomValue();
        testCustomValues.fullName = 'test-1';
        testCustomValues.label = 'test-1';
        testCustomValues.default_x = false;
        MetadataService.CustomValue orgValue = new MetadataService.CustomValue();
        testCustomValues.fullName = 'Test Name';
        testCustomValues.label = 'Test Name';
        testCustomValues.default_x = false;
        testValues.customValue = new List<MetadataService.CustomValue>{testCustomValues};
        return new List<MetadataService.GlobalValueSet>{testValues};
       }
      }
    @isTest
    static void testDefaultsValues(){
        DefaultsController.JobDefaults testJob = new DefaultsController.JobDefaults('\"08:00 AM\"','\"06:00 PM\"',(Decimal)4,true,false);
        String testJobstr = JSON.serialize(testJob);
        System.Test.startTest();
            Boolean res = DefaultsController.setDefaults(testJobstr);
        System.Test.stopTest();
        List<Job_Default_Times__c> jobsData = Job_Default_Times__c.getAll().values();
        for(Job_Default_Times__c jdt : jobsData) {
            System.assert(jdt.Id != null);
            System.assertEquals('\"08:00 AM\"', jdt.Start_Time__c );
            System.assertEquals(true, jdt.Include_Saturday__c);
        }
    }
    @isTest
    static void testPickListValues(){
        System.Test.setMock(WebServiceMock.class, new WebServiceMockImpl());
        Test.startTest();
            List<DefaultsController.ColorDefaults> listOfColors = DefaultsController.fetchPicklistValues();
        Test.stopTest();
        System.assert(listOfColors.size() > 0);
    }
    @isTest
    static void testFetchCustomSettings() {
        Job_Default_Times__c testJob = new Job_Default_Times__c(Name = 'Job Test',Start_Time__c = '\"08:00 AM\"',End_Time__c = '\"06:00 PM\"'/*,Max_allow_distance__c = (Decimal) 4*/,Include_Saturday__c = true);
        INSERT testJob;
        Test.startTest();
            DefaultsController.JobDefaults jobs = DefaultsController.fetchJobsData();
        Test.stopTest();
            //System.assertEquals(4.0, jobs.maxDistance);
            System.assertEquals('\"08:00 AM\"', jobs.startTime);
            System.assertEquals(true, jobs.saturdayData);
    }
    @isTest
    static void testAddPickListValues(){
        System.Test.setMock(WebServiceMock.class, new WebServiceMockImpl());
        DefaultsController.ColorDefaults newTestVal = new DefaultsController.ColorDefaults();
        newTestVal.statusName = 'Test-2';
        newTestVal.bkColor = '#000000';
        newTestVal.color = '#FFFFFF';
        List<DefaultsController.ColorDefaults> testValues = new List<DefaultsController.ColorDefaults>();
        testValues.add(newTestVal);
        String newPickListValues = JSON.serialize(testValues);
        Test.startTest();
            DefaultsController.updatePicklist(newPickListValues);
        Test.stopTest();
        List<Mobilization_Status_Color__c> jobMobilizations = Mobilization_Status_Color__c.getAll().values();
        System.debug(jobMobilizations);
        System.assert(jobMobilizations.size() > 0);
        
    }
    @isTest
    static void testAddedPickListValues(){
        System.Test.setMock(WebServiceMock.class, new WebServiceMockImpl());
        Mobilization_Status_Color__c msc  = new Mobilization_Status_Color__c(Name = 'Test Name',Background_Color__c = '#000000',Color__c  = '#FFFFFF');
        INSERT msc;
        Mobilization_Status_Color__c msc2  = new Mobilization_Status_Color__c(Name = 'test-1',Background_Color__c = '#000000',Color__c  = '#FFFFFF');
        INSERT msc2;
        Test.startTest();
        List<DefaultsController.ColorDefaults> listOfColors = DefaultsController.fetchPicklistValues();
        Test.stopTest();
        System.assert(listOfColors.size() == 2);
    }
    @isTest
    static void testOrgObject(){
        Test.setMock(HttpCalloutMock.class, new OrganizationUpdateMock());
        DefaultsController.CompanyData cd = DefaultsController.fetchCompanyData();
        System.debug('Hi!' + cd);
        Test.startTest();
            DefaultsController.updateCompanyData(JSON.serialize(cd));
        Test.stopTest();
        Assert.areEqual(cd != NULL, TRUE);
    }
    @isTest
    static void testUserProfMethod(){
        Test.startTest();
            Boolean res = DefaultsController.getUserProfileData();
        Test.stopTest();
        System.assert(res != null);
    }
    @isTest
    static void testDeletePicklist(){
        System.Test.setMock(WebServiceMock.class, new WebServiceMockImpl());
        Mobilization_Status_Color__c msc  = new Mobilization_Status_Color__c(Name = 'Test Name',Background_Color__c = '#000000',Color__c  = '#FFFFFF');
        INSERT msc;
        DefaultsController.ColorDefaults cd = new DefaultsController.ColorDefaults();
        cd.statusName = 'Test Name';
        cd.apiName = 'Test Name';
        cd.color = '#000000';
        cd.bkColor = '#FFFFFF';
        cd.idOfRecord = msc.Id;
        Test.startTest();
            DefaultsController.deletePicklistValues(JSON.serialize(cd));
        Test.stopTest();
        Assert.areEqual(cd != NULL, TRUE);
    }
    @isTest
    static void checkProfileMetaDataAccess(){
        Test.startTest();
            Boolean res = DefaultsController.checkMetaDataAccess();
        Test.stopTest();
        System.assert(res != null);
    }
    @isTest
    static void checkJobDefaultsSize(){
        Job_Default_Times__c testJob = new Job_Default_Times__c(Name = 'Job Test',Start_Time__c = '\"08:00 AM\"',End_Time__c = '\"06:00 PM\"'/*,Max_allow_distance__c = (Decimal) 4*/,Include_Saturday__c = true);
        INSERT testJob;
        Test.startTest();
            Integer res = DefaultsController.fetchCustomSettings();
        Test.stopTest();
        System.assert(res == 1);
    }
    @isTest
    static void getClockInDefaultTest(){
        Test.startTest();
            Boolean res = DefaultsController.getClockInDefault();
        Test.stopTest();
        System.assert(res != null);
    }
    @isTest
    static void updateClockInDefaultTest(){
        Test.startTest();
            DefaultsController.updateClockInDefault(true);
        Test.stopTest();
    }
}
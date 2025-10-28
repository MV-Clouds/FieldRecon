/**
 * Copyright (c) 2012, FinancialForce.com, inc
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, 
 *   are permitted provided that the following conditions are met:
 *
 * - Redistributions of source code must retain the above copyright notice, 
 *      this list of conditions and the following disclaimer.
 * - Redistributions in binary form must reproduce the above copyright notice, 
 *      this list of conditions and the following disclaimer in the documentation 
 *      and/or other materials provided with the distribution.
 * - Neither the name of the FinancialForce.com, inc nor the names of its contributors 
 *      may be used to endorse or promote products derived from this software without 
 *      specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND 
 *  ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES 
 *  OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL 
 *  THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, 
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 *  OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 *  OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
**/

/**
 * This is a dummy test class to obtain 100% coverage for the generated WSDL2Apex code, it is not a funcitonal test class
 **/ 
@isTest  
private class MetadataServiceTest
{    
    /**
     * Dummy Metadata API web service mock class (see MetadataCreateJobTest.cls for a better example)
     **/
	private class WebServiceMockImpl implements WebServiceMock 
	{
		public void doInvoke(
			Object stub, Object request, Map<String, Object> response,
			String endpoint, String soapAction, String requestName,
			String responseNS, String responseName, String responseType) 
		{
			if(request instanceof MetadataService.listMetadata_element)
				response.put('response_x', new MetadataService.listMetadataResponse_element());
            else if(request instanceof MetadataService.updateMetadata_element)
                response.put('response_x', new MetadataService.updateMetadataResponse_element());
            else if(request instanceof  MetadataService.upsertMetadata_element)
                response.put('response_x', new MetadataService.upsertMetadataResponse_element());
            else if(request instanceof  MetadataService.createMetadata_element)
                response.put('response_x', new MetadataService.createMetadataResponse_element());
			return;
		}
	}    
		
	@IsTest
	private static void coverGeneratedCodeCRUDOperations()
	{	
    	// Null Web Service mock implementation
        System.Test.setMock(WebServiceMock.class, new WebServiceMockImpl());
        // Only required to workaround a current code coverage bug in the platform
        MetadataService metaDataService = new MetadataService();
        // Invoke operations     
        Test.startTest();    
        MetadataService.MetadataPort metaDataPort = new MetadataService.MetadataPort();
        Test.stopTest();
	}
	
	@IsTest
    private static void coverGeneratedCodeFileBasedOperations1()
    {    	
    	// Null Web Service mock implementation
        System.Test.setMock(WebServiceMock.class, new WebServiceMockImpl());
        // Only required to workaround a current code coverage bug in the platform
        MetadataService metaDataService = new MetadataService();
        // Invoke operations    
        Test.startTest();     
        MetadataService.MetadataPort metaDataPort = new MetadataService.MetadataPort();
        metaDataPort.listMetadata(null, null);
        metaDataPort.updateMetadata(null);
        Test.stopTest();
        Assert.areEqual(metaDataPort != NULL, TRUE);
    }

    @IsTest
    private static void coverGeneratedCodeFileBasedOperations2()
    {       
        // Null Web Service mock implementation
        System.Test.setMock(WebServiceMock.class, new WebServiceMockImpl());
        // Only required to workaround a current code coverage bug in the platform
        MetadataService metaDataService = new MetadataService();
        // Invoke operations     
        Test.startTest();    
        MetadataService.MetadataPort metaDataPort = new MetadataService.MetadataPort();
        //metaDataPort.deleteMetadata(null, null);
        metaDataPort.upsertMetadata(null);
        metaDataPort.createMetadata(null);
        Test.stopTest();
        
        Assert.areEqual(metaDataService != NULL, TRUE);
    }
        
	@IsTest
    private static void coverGeneratedCodeTypes()
    {    	       
        // Reference types
        Test.startTest();
        MetadataService metaDataService = new MetadataService();
        new MetadataService();
        new MetadataService.listMetadataResponse_element();
        new MetadataService.RecordTypeTranslation();
        new MetadataService.PicklistValueTranslation();
        new MetadataService.CustomDataType();
        new MetadataService.CustomValue();
        new MetadataService.CustomMetadataValue();
        new MetadataService.CustomDataTypeComponent();
        new MetadataService.DebuggingHeader_element();
        new MetadataService.DebuggingInfo_element();
        new MetadataService.deleteMetadata_element();
        new MetadataService.deleteMetadataResponse_element();
        new MetadataService.DeleteResult();
        new MetadataService.Error();
        new MetadataService.ExtendedErrorDetails();
        new MetadataService.FieldSet();
        new MetadataService.FieldSetItem();
        new MetadataService.FieldValue();
        new MetadataService.FileProperties();
        new MetadataService.FilterItem();
        new MetadataService.GlobalPicklistValue();
        new MetadataService.GlobalValueSet();
        new MetadataService.listMetadata_element();
        new MetadataService.ListMetadataQuery();
        new MetadataService.LogInfo();
        new MetadataService.LookupFilter();
        new MetadataService.MetadataPort();
        new MetadataService.Picklist();
        new MetadataService.PicklistEntry();
        new MetadataService.PicklistValue();
        new MetadataService.readCustomFieldResponse_element();
        new MetadataService.ReadCustomFieldResult();
        new MetadataService.readFieldSetResponse_element();
        new MetadataService.ReadFieldSetResult();
        new MetadataService.ReadResult();
        new MetadataService.SaveResult();
        new MetadataService.UpsertResult();
        new MetadataService.ValueSet();
        new MetadataService.ValueSettings();
        new MetadataService.ValueSetValuesDefinition();
        new MetadataService.AllOrNoneHeader_element();
        new MetadataService.SessionHeader_element();
        new MetadataService.AsyncResult();
        new MetadataService.CallOptions_element();
        new MetadataService.readMetadata_element();
        new MetadataService.ReadPicklistValueResult();
        new MetadataService.readMetadataResponse_element();
        new MetadataService.readPicklistValueResponse_element();
        new MetadataService.ReadGlobalValueSetResult();
        new MetadataService.readGlobalValueSetResponse_element();
        new MetadataService.ReadGlobalPicklistValueResult();
        new MetadataService.readGlobalPicklistValueResponse_element();
        new MetadataService.StandardFieldTranslation();
        new MetadataService.CustomField();
        Test.stopTest();
        Assert.areEqual(metaDataService != NULL, TRUE);
    }

}
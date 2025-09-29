@isTest
public with sharing class OrganizationUpdateMock implements HttpCalloutMock {
    public static HTTPResponse respond(HTTPRequest request){
        HttpResponse response = new HttpResponse();
        response.setHeader('Content-Type', 'application/json');
        response.setStatusCode(200);
        return response;
    } 
}
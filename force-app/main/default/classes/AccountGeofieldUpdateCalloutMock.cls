@isTest
public class AccountGeofieldUpdateCalloutMock implements HttpCalloutMock {
    //Test Class
    public HttpResponse respond(HTTPRequest req) {
        HttpResponse response = new HttpResponse();
        response.setHeader('Content-Type', 'application/json');
        response.setBody(
            '{"address": ["Near, D-404 The First Synthesis B/H Keshav Baugh Party Plot, Shivalik High-Street"]}'
        );
        response.setStatusCode(200);

        return response;
    }
}
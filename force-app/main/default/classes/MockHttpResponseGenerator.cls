@IsTest
public with sharing class MockHttpResponseGenerator implements HttpCalloutMock {
    public HttpResponse response;

    public MockHttpResponseGenerator(HttpResponse response) {
        this.response = response;
    }

    public HttpResponse respond(HttpRequest req) {
        return response;
    }

    // ✅ Helper class for handling multiple sequential callouts
    public class Multi implements HttpCalloutMock {
        private List<HttpResponse> responses;
        private Integer index = 0;

        public Multi(List<HttpResponse> responses) {
            this.responses = responses;
        }

        public HttpResponse respond(HttpRequest req) {
            if (index < responses.size()) {
                return responses[index++];
            }

            // Default fallback
            HttpResponse defaultRes = new HttpResponse();
            defaultRes.setStatusCode(500);
            defaultRes.setBody('Unexpected callout');
            return defaultRes;
        }
    }
}
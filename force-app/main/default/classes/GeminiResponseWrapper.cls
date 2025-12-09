public with sharing class GeminiResponseWrapper {
    
    public List<Candidate> candidates;
    public UsageMetadata usageMetadata;
    public String modelVersion;
    public String responseId;

    public class Candidate {
        public Content content;
        public String finishReason;
        public Integer index;
    }

    public class Content {
        public List<Part> parts;
        public String role;
    }

    public class Part {
        public String text;
    }

    public class UsageMetadata {
        public Integer promptTokenCount;
        public Integer candidatesTokenCount;
        public Integer totalTokenCount;
        public List<TokenDetail> promptTokensDetails;
        public List<TokenDetail> candidatesTokensDetails;
        public Integer thoughtsTokenCount;
    }

    public class TokenDetail {
        public String modality;
        public Integer tokenCount;
    }

    // Optional: A helper method to deserialize the JSON string
    public static GeminiResponseWrapper parse(String responseString) {
        return (GeminiResponseWrapper) JSON.deserialize(responseString, GeminiResponseWrapper.class);
    }

    // ---- Error Based Wrapper ----

    public ApiError error;

    public class ApiError {
        public Integer code; // HTTP status code (e.g., 400, 403, 500)
        public String message; // Human-readable error message
        public String status; // Generic status (e.g., "INVALID_ARGUMENT", "PERMISSION_DENIED")
        public List<Detail> details; // More specific, structured error details (often optional)
    }

    // This class is often optional, but good to include for completeness
    public class Detail {
        public String type_x;
        public List<Link> links;
        public List<Violation> violations;
        public String retryDelay;
    }

    public class Link{
        public String description;
        public String url;
    }

    public class Violation {
        public String quotaMetric; // e.g., "generativelanguage.googleapis.com/generate_content_free_tier_requests"
        public String quotaId; // e.g., "GenerateRequestsPerDayPerProjectPerModel-FreeTier"
        public QuotaDimensions quotaDimensions; // The specific dimensions (model, location)
    }

    public class QuotaDimensions {
        public String model; // e.g., "gemini-2.0-flash"
        public String location; // e.g., "global"
    }

}
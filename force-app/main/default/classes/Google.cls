public class Google {
    public class Address_components {
        public String long_name;
        public String short_name;
        public List<String> types;
    }

    public class Geometry {
        public Bounds bounds;
        public Northeast location;
        public String location_type;
        public Bounds viewport;
    }

    public List<Results> results;
    public String status;

    public class Results {
        public List<Address_components> address_components;
        public String formatted_address;
        public Geometry geometry;
        public String place_id;
        public List<String> types;
    }

    public class Bounds {
        public Northeast northeast;
        public Northeast southwest;
    }

    public class Northeast {
        public Double lat;
        public Double lng;
    }

    public static Google parse(String json) {
        return (Google) System.JSON.deserialize(json, Google.class);
    }
}
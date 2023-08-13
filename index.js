const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1nqrclq.mongodb.net/?retryWrites=true&w=majority`;

// Middleware >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
app.use(cors());
app.use(express.json());

// JWT verify middleware code here ..................................
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access" });
  }
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};
// MONGODB CODE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
//important note : remove try function before vercel deploy
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // mongodb database and collection ..................................
    const db = client.db("workflow");
    const employeesCollection = db.collection("employees");
    const attendanceCollection = db.collection("attendance");

    // ADMIN CODES HERE .........................................................................................
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }

      const query = { email: email };
      const user = await employeesCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // jwt api
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "3h",
      });
      res.send({ token });
    });
    // admin verify code
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await employeesCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access" });
      }
      next();
    };

    // USERS CODES HERE  ..................................................
    // post new user
    app.post("/users",async (req, res) => {
      const user = req.body;
      console.log("New user", user);
      const query = { email: user.email };
      const existingUser = await employeesCollection.findOne(query);
      console.log(existingUser);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await employeesCollection.insertOne(user);
      res.send(result);
    });
    // Get API FOR USERS
    app.get("/users", async (req, res) => {
      const cursor = employeesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    // GET SPECIFIC DATA BY EMAIL
    app.get("/employee/:email", async (req, res) => {
      const result = await employeesCollection
        .find({
          email: req.params.email,
        })
        .toArray();
      res.send(result);
    });
    //GET SPECIFIC DATA BY id
    app.get("/users/:id", (req, res) => {
      const id = req.params.id;
      employeesCollection
        .findOne({ _id: new ObjectId(id) })
        .then((result) => {
          if (!result) return res.status(404).send("User not found");
          res.send(result);
        })
        .catch((error) => res.status(500).send("Internal server error"));
    });
    // User patch api ..
    app.patch("/users/:email", async (req, res) => {
      const emailToUpdate = req.params.email;
      const updatedData = req.body;

      const query = { email: emailToUpdate };
      const result = await employeesCollection.updateOne(query, {
        $set: updatedData,
      });

      if (result.modifiedCount === 0) {
        return res.status(404).send({ message: "User not found" });
      }

      res.send({ message: "User updated successfully" });
    });
    // User delete api
    app.delete("/users/:email", async (req, res) => {
      const emailToDelete = req.params.email;

      const query = { email: emailToDelete };
      const result = await employeesCollection.deleteOne(query);

      if (result.deletedCount === 0) {
        return res.status(404).send({ message: "User not found" });
      }

      res.send({ message: "User deleted successfully" });
    });

    // Attendance Code here ..........
    // post new attendance record
    app.post("/attendance", async (req, res) => {
      const attendanceRecord = req.body;
      const existingRecord = await attendanceCollection.findOne({
        email: attendanceRecord.email,
        date: attendanceRecord.date,
      });

      if (existingRecord) {
        res
          .status(400)
          .send(
            `Attendance for ${attendanceRecord.date} has already been taken.`
          );
      } else {
        const result = await attendanceCollection.insertOne(attendanceRecord);
        res.send(result);
      }
    });

    // Get all attendance records
    app.get("/attendance", async (req, res) => {
      const cursor = attendanceCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get attendance records for a specific employee by email
    app.get("/attendance/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const cursor = attendanceCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Update attendance record for a specific employee by email and date
    app.put("/attendance/:email/:date", async (req, res) => {
      const email = req.params.email;
      const date = req.params.date;
      const query = { email: email, date: date };
      const newAttendanceData = req.body;
      const result = await attendanceCollection.updateOne(query, {
        $set: newAttendanceData,
      });
      res.send(result);
    });

    // Delete attendance record for a specific employee by email and date
    app.delete("/attendance/:email/:date", async (req, res) => {
      const email = req.params.email;
      const date = req.params.date;
      const query = { email: email, date: date };
      const result = await attendanceCollection.deleteOne(query);
      res.send(result);
    });

    // The api code area is over here is the mongo db ping code...........
    // Send a ping to confirm a successful connection to MONGODB
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(" Work flow running  Alhamdulillah!");
});
// starting the server>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
app.listen(port, () => {
  console.log(`Alhamdulillah the server running at the ${port} port`);
});

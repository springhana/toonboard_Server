const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const app = express();

// socket.io
const http = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(http, {
  cors: {
    origin: "*",
  },
});

// env
require("dotenv").config();

// PUT 위한 것
// body-parser 미들웨어를 사용하여 POST 요청 본문을 파싱
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ===================

app.use(express.json());
var cors = require("cors");
app.use(
  cors({
    origin: "*", // 모든 출처 허용 옵션. true 를 써도 된다.
  })
);

app.use("/public/image", express.static(path.join(__dirname, "/public/image")));

const session = require("express-session");
const cookieParser = require("cookie-parser");
app.use(cookieParser());

const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

const methodOverride = require("method-override");
app.use(methodOverride("_method"));

const MongoClient = require("mongodb").MongoClient;
const url = process.env.DATABASE_URL;
var db;
MongoClient.connect(url, { useUnifiedTopology: true }, function (에러, client) {
  if (에러) {
    return console.log(에러);
  }

  db = client.db("Webtoon"); // Webtoon 이라는 database(폴더)에 연결

  http.listen(8080, function () {
    console.log("listening on 8080");
  });
});

app.get("/", (req, res) => {
  res.send("성공");
});
// 이미지 업로드
let multer = require("multer");
const fs = require("fs");
const { ObjectId } = require("mongodb");
// 날짜
const Today = (type) => {
  const date = new Date();
  const Y = date.getFullYear();
  const M = date.getMonth() + 1;
  const D = date.getDate();

  const hours = date.getHours(); // 시간을 가져옵니다.
  const minutes = date.getMinutes(); // 분을 가져옵니다.
  const seconds = date.getSeconds(); // 초를 가져옵니다.
  if (type === "day") {
    return `${Y}-${M}-${D}`;
  } else if (type === "time") {
    return `${Y}-${M}-${D}:${hours}:${minutes}:${seconds}`;
  }
};

let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    db.collection("count")
      .findOne({ name: "게시물/댓글" })
      .then((result) => {
        console.log("url : " + req.url);
        let _id = req.user ? req.user._id : null;
        let date = Today("day");
        let postNumber; // 게시판 기본키
        let url;
        let postComment; // 댓글 기본키

        // PUT 요청에서만 postNumber를 추가
        if (req.method === "PUT") {
          postNumber = req.body.postNumber;
          postComment = req.body.totalComment;
        } else {
          postNumber = result.totalPost + 1;
          postComment = result.totalComment + 1;
        }

        console.log(req.url);
        // url에 변경
        if (req.url === "/write") {
          url = "board";
        } else if (req.url === "/edit") {
          url = "board";
        } else if (req.url === "/commentPost") {
          postNumber = req.body.postNumber + "-" + postComment;
          url = "comment";
        } else if (req.url === "/editComment") {
          postNumber = req.body.postNumber + "-" + postComment;
          url = "comment";
        }

        let dir = `./public/image/${url}/${_id}/${date}/${postNumber}`;
        if (req.url === "/register" || req.url === "/user/update") {
          url = "user";
          let id = req.body.id;
          dir = `./public/image/${url}/${id}`;
        }
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true }); // recursive 옵션을 true로 설정하여 중간 디렉토리도 함께 생성
        }

        cb(null, dir);
      });
  },

  filename: function (req, file, cb) {
    // 이미지 이름 깨짐
    file.originalname = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );
    cb(null, file.originalname.trim());
  },
  fileFilter: function (req, file, callback) {
    var ext = path.extname(file.originalname);
    if (ext !== ".png" && ext !== ".jpg" && ext !== ".jpeg") {
      return callback(new Error("PNG, JPG만 업로드하세요"));
    }
    callback(null, true);
  },
  limits: {
    fileSize: 1024 * 1024,
  },
});
var upload = multer({ storage: storage });

// 로그인

app.use(
  session({
    secret: "my-secret-key", // 세션 비밀 키
    resave: false, // 세션 데이터가 변경되지 않더라도 세션을 항상 다시 저장 여부
    saveUninitialized: false, // 초기화되지 않은 세션을 저장할지 여부
    cookie: { maxAge: 3600000 }, // 1시간 유효한 세션
  })
);
app.use(passport.session());
app.use(passport.initialize()); // passport 로그인 쉡게 도와줌

app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/fail",
  }),
  (req, res) => {
    console.log("로그인 성공");
    res.json({ login: true, _id: req.user._id });
  }
);

// 로그인 할 때만 실행 위에 코드
passport.use(
  new LocalStrategy(
    {
      usernameField: "id",
      passwordField: "pw",
      session: true,
      passReqToCallback: false, // true로 하면 다른 정보들도 받을 수 있다
    },
    function (id, pw, done) {
      db.collection("login").findOne({ id: id }, function (에러, 결과) {
        // 흔한 에러 처리
        if (에러) return done(에러);

        // db에 아이디가 없으면
        if (!결과)
          return done(null, false, { message: "존재하지않는 아이디요" });
        // db에 아이디가 있으면 입련한 비번과 결과.pw 비교 // 비번은 암오화 해야 된다. 아니면 보안이 안좋다
        if (pw == 결과.pw) {
          return done(null, 결과);
        } else {
          return done(null, false, { message: "비번틀렸어요" });
        }
        // done() = 서버에러를 넣는곳, 성공시 사용자 DB데이터, 에러메세지
      });
    }
  )
);

// 세션을 저장시키는 코드 (로그인 성공시) - id를 이용해서 세션을 저장시키는 코드(로그인 성공시 발동)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// 이 세션 데이터를 가진 사람을 DB에서 찾아주세요 (마이페이지 접속시 발동)
passport.deserializeUser((id, done) => {
  // 디비에서 위에있는 user.id로 유저를 찾은 뒤에 유저 정보를 done({})에 넣어주세여
  db.collection("login").findOne({ id: id }, (error, result) => {
    done(null, result);
  });
});

// 회원가입
app.post("/register", upload.single("profile"), (req, res) => {
  db.collection("login").findOne({ id: req.body.id }, (error, result) => {
    if (result) {
      console.log("아이디있음");
    } else {
      db.collection("login").insertOne(
        {
          id: req.body.id,
          pw: req.body.pw,
          name: req.body.name,
          email: req.body.email,
          image: req.file
            ? parseInt(req.body.deleteImg) === 0
              ? req.file.filename
              : "default.jpg"
            : "default.jpg",
          totalBoard: 0,
          totalComment: 0,
        },
        (error, result) => {
          console.log("회원가입 성공");
          // 로그인 해주기
          res.json({ register: true });
        }
      );
    }
  });
});

// 로그인했는지
function Login(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.json({ login: false });
    res.redirect("/");
  }
}

app.get("/loginCheck", (req, res) => {
  if (req.user && req.user._id) {
    db.collection("login")
      .findOne({ _id: req.user._id })
      .then((result) => {
        if (result) {
          const user = { login: true, _id: req.user._id };
          res.json(user);
        }
      });
  }
});

// 로그아웃
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session", err);
      res.status(500).json({ error: "Server error" });
    } else {
      console.log("로그아웃");
      res.clearCookie("connect.sid");
      res.redirect("/");
    }
  });
});

// 마이페이지
app.get("/myPage/:_id", Login, (req, res) => {
  // db 마이페이지 추가
  db.collection("subscribe")
    .findOne({ userId: req.user._id })
    .then((result) => {
      console.log("마이페이지가 있네요");
      res.json({ login: true, name: req.user.name });
    });
});

// 구독 시스템
app.post("/subscribe", Login, (req, res) => {
  db.collection("subscribe")
    .findOne({ userId: req.user._id })
    .then((result) => {
      if (result) {
        if (result.title.includes(req.body.title)) {
          console.log("중복?");
          return;
        }

        // db 업데이트
        db.collection("subscribe")
          .updateOne(
            { userId: req.user._id },
            { $set: { title: [...result.title, req.body.title] } }
          )
          .then((result) => {
            if (result) console.log("성공?");
          });
      } else {
        const save = { userId: req.user._id, title: [req.body.title] };
        db.collection("subscribe")
          .insertOne(save)
          .then((result) => {
            console.log("입력 성공?");
          });
      }
    });
});

app.get("/subscribeAll", Login, (req, res) => {
  db.collection("subscribe")
    .findOne({ userId: req.user._id })
    .then((result) => {
      if (result) {
        // console.log(result);
        res.json(result);
      }
    });
});

// 구독 취소
app.post("/remove_subscribe", (req, res) => {
  db.collection("subscribe")
    .findOne({ userId: req.user._id })
    .then((result) => {
      if (result) {
        console.log("구독 취소");
        const title = result.title;
        const newTitle = title.filter((item) => item !== req.body.title);
        console.log(title);
        db.collection("subscribe")
          .updateOne({ userId: req.user._id }, { $set: { title: newTitle } })
          .then((result) => {
            if (result) console.log("성공?");
          });
      }
    });
});

// 게시판

// 페이징 처리
app.get("/board", (req, res) => {
  const page = parseInt(req.query.page) || 1;

  db.collection("board").countDocuments((error, result) => {
    const perPage = 15; // 한 페이지에 보여줄 게시판 수
    const currentPage = parseInt(req.params.page) || 1;
    const totalPosts = result;
    const totalPages = Math.ceil(totalPosts / perPage);

    if (currentPage > totalPages) {
      // 요청한 페이지가 존재하지 않을 경우
      return res.send("존재하지 않는 페이지입니다.");
    }
    db.collection("board")
      .find()
      .skip((parseInt(page) - 1) * perPage)
      .limit(perPage)
      .toArray((error, result) => {
        // console.log(result, totalPages, currentPage);
        const board = { result, totalPages, currentPage };
        res.json(board);
      });
  });

  // console.log(totalPosts);
});

// 글쓰기
app.post("/write", upload.single("profile"), (req, res) => {
  db.collection("count")
    .findOne({ name: "게시물/댓글" })
    .then((result) => {
      let totalPost = result.totalPost;
      let board = {
        userId: req.user._id,
        postNumber: totalPost + 1,
        author: req.user.name,
        title: req.body.title,
        content: req.body.content,
        image: req.file
          ? parseInt(req.body.deleteImg) === 0
            ? req.file.filename
            : "default.jpg"
          : "default.jpg",
        date: Today("time"),
        likedIds: [],
      };

      db.collection("board")
        .insertOne(board)
        .then((result) => {
          db.collection("count").updateOne(
            { name: "게시물/댓글" },
            { $inc: { totalPost: 1 } },
            (error, result) => {
              if (error) {
                return console.log(error);
              }
            }
          );
          console.log("글쓰기 성공 : " + result);
        });
      // 유저 게시판 수
      db.collection("login").updateOne(
        {
          _id: ObjectId(req.user._id),
        },
        { $inc: { totalBoard: 1 } },
        (error, result) => {
          if (error) console.log(error);
        }
      );

      res.json({ write: true });
    });
});

// 검색 기능
app.get("/search", (req, res) => {
  let search = [
    {
      $search: {
        index: "BoardSearch",
        text: {
          query: req.query.value,
          path: ["title", "content"],
        },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 1,
        postNumber: 1,
        author: 1,
        title: 1,
        content: 1,
        image: 1,
        date: 1,
        score: { $meta: "searchScore" },
      },
    },
  ];

  db.collection("board")
    .aggregate(search) // mongodb index에서 검색
    .toArray((error, result) => {
      console.log(result);
      res.json(result);
    });
});

// 게시판 글 가져오기
app.get("/boardDeatil", (req, res) => {
  db.collection("board")
    .findOne({
      postNumber: parseInt(req.query.postNumber),
    })
    .then((result) => {
      // console.log(result);
      res.json(result);
    });
});

// 이미지 불러오기
app.get("/images", upload.single("profile"), (req, res) => {
  if (req.query.image !== "default.jpg") {
    let PostNumber = req.query.postNumber;
    if (req.query.totalComment) {
      PostNumber += "-" + req.query.totalComment;
    }
    let url = `${req.query.userId}/${req.query.date}/${PostNumber}/${req.query.image}`;
    let file;
    if (req.query.file === "board") {
      file = "board";
    } else if (req.query.file === "comment") {
      file = "comment";
    } else if (req.query.file === "user") {
      file = "user";
      url = `${req.query.id}/${req.query.image}`;
    }
    console.log(file);
    res.sendFile(path.join(__dirname, `public/image/${file}`, url));
  }
});

// 글 삭제
app.delete("/delete", (req, res) => {
  console.log(req.query._id);
  let data = {
    _id: ObjectId(req.query._id),
    postNumber: parseInt(req.query.postNumber),
  };
  console.log(data);
  db.collection("board").deleteOne(data, (error, result) => {
    if (error) {
      console.log(error);
    }
    if (result) {
      console.log(result);
    }
  });

  // 유저 게시판 수
  db.collection("login").updateOne(
    {
      _id: ObjectId(req.user._id),
    },
    { $inc: { totalBoard: -1 } },
    (error, result) => {
      if (error) console.log(error);
    }
  );
});

// 글 수정
app.put("/edit", upload.single("profile"), (req, res) => {
  db.collection("board")
    .findOne({ _id: ObjectId(req.body._id) })
    .then((result) => {
      let board = {
        title: req.body.title,
        content: req.body.content,
        image: req.file
          ? req.file.filename
          : parseInt(req.body.deleteImg) === 0
          ? result.image
          : "default.jpg",
        date: Today("time") + " / 수정",
      };
      db.collection("board").updateOne(
        {
          _id: ObjectId(req.body._id),
          postNumber: parseInt(req.body.postNumber),
        },
        { $set: board },
        (error, result) => {
          console.log("수정 성공");
          res.json({ update: true });
        }
      );
    });
});

// 게시판 댓글
app.post("/commentPost", upload.single("profile"), (req, res) => {
  db.collection("count")
    .findOne({ name: "게시물/댓글" })
    .then((result) => {
      let comment = {
        boardId: req.body.boardId,
        userId: req.user._id,
        postNumber: parseInt(req.body.postNumber),
        title: req.body.title,
        author: req.user.name,
        comment: req.body.comment,
        image: req.file
          ? parseInt(req.body.deleteImg) === 0
            ? req.file.filename
            : "default.jpg"
          : "default.jpg",
        date: Today("time"),
        totalComment: result.totalComment + 1,
        likedIds: [],
      };
      db.collection("comment")
        .insertOne(comment)
        .then((result) => {
          db.collection("count").updateOne(
            { name: "게시물/댓글" },
            { $inc: { totalComment: 1 } },
            (error, result) => {
              if (error) {
                return console.log(error);
              }
            }
          );
          console.log("글쓰기 성공 : " + result);
        });
    });
  // 유저 게시판 수
  db.collection("login").updateOne(
    {
      _id: ObjectId(req.user._id),
    },
    { $inc: { totalComment: 1 } },
    (error, result) => {
      if (error) console.log(error);
    }
  );
  res.json({ write: true });
});
// 게시판 댓글 가져오기
app.get("/comment", (req, res) => {
  db.collection("comment")
    .find({ boardId: req.query.boardId })
    .toArray()
    .then((result) => {
      if (result) {
        // console.log(result);
        res.json(result);
      }
    });
});

// 댓글 삭제하기
app.delete("/commentDelete", (req, res) => {
  let data = {
    userId: ObjectId(req.user._id),
    _id: ObjectId(req.query._id),
  };
  console.log(data);
  db.collection("comment").deleteOne(data, (error, result) => {
    if (error) {
      console.log(error);
    }
    if (result) {
      console.log(result);
    }
  });
  // 유저 게시판 수
  db.collection("login").updateOne(
    {
      _id: ObjectId(req.user._id),
    },
    { $inc: { totalComment: -1 } },
    (error, result) => {
      if (error) console.log(error);
    }
  );
  res.json({ Delete: true });
});

// 댓글 수정을 위한 댓글 하나 가져오기
app.get("/commentOne", (req, res) => {
  db.collection("comment")
    .findOne({ totalComment: parseInt(req.query.totalComment) })
    .then((result) => {
      console.log(result);
      res.json(result);
    });
});

// 댓글 수정
app.put("/editComment", upload.single("profile"), (req, res) => {
  let comment = {
    comment: req.body.comment,
    image: req.file ? req.file.filename : "default.jpg",
    date: Today("time") + " / 수정",
  };

  db.collection("comment").updateOne(
    {
      _id: ObjectId(req.body._id),
      totalComment: parseInt(req.body.totalComment),
    },
    { $set: comment },
    (error, result) => {
      console.log("댓글 수정 성공");
      res.json({ update: true });
    }
  );
});

// 만화 댓글 좋아요
app.put("/like", Login, (req, res) => {
  db.collection("comment")
    .findOne({ _id: ObjectId(req.body._id) })
    .then((result) => {
      let likedIds;
      if (
        result.likedIds.some(
          (like) =>
            ObjectId(like).toString() === ObjectId(req.user._id).toString()
        )
      ) {
        console.log("중복");
        // 좋아요 중복시 삭제
        likedIds = result.likedIds.filter(
          (like) =>
            ObjectId(like).toString() !== ObjectId(req.user._id).toString()
        );
      } else {
        // 좋아요 추가
        console.log("추가");
        likedIds = [...result.likedIds, req.user._id];
      }

      let comment = {
        likedIds: likedIds,
      };

      db.collection("comment").updateOne(
        { _id: ObjectId(req.body._id) },
        { $set: comment },
        (error, result) => {
          if (result) {
            res.json({ like: true });
          }
        }
      );
    });
});

// 만화 디테일마다 댓글 달기
app.post("/webtoon/comment", (req, res) => {
  db.collection("count")
    .findOne({ name: "게시물/댓글" })
    .then((result) => {
      let comment = {
        webtoonID: req.body.webtoonID,
        userId: req.user._id,
        author: req.user.name,
        comment: req.body.comment,
        date: Today("time"),
        totalWebtoon: result.totalWebtoon + 1,
        likedIds: [],
      };
      db.collection("webtoonComment")
        .insertOne(comment)
        .then((result) => {
          db.collection("count").updateOne(
            { name: "게시물/댓글" },
            { $inc: { totalWebtoon: 1 } },
            (error, result) => {
              if (error) {
                return console.log(error);
              }
            }
          );
          console.log("만화 댓글 성공 : " + result);
          res.json(result);
        });
    });
});
// 만화 댓글 전부 가져오기
app.get("/webtoon/commentAll", (req, res) => {
  db.collection("webtoonComment")
    .find({ webtoonID: req.query.webtoonID })
    .toArray()
    .then((result) => {
      if (result) {
        // console.log(result);
        res.json(result);
      }
    });
});

// 만화 댓글 삭제하기
app.delete("/webtoon/delete", (req, res) => {
  let data = {
    userId: ObjectId(req.user._id),
    _id: ObjectId(req.query._id),
  };
  console.log(data);
  db.collection("webtoonComment").deleteOne(data, (error, result) => {
    if (error) {
      console.log(error);
    }
    if (result) {
      console.log(result);
    }
  });
});

// 만화 댓글 수정
app.put("/webtoon/update", (req, res) => {
  let comment = { comment: req.body.comment, date: Today("time") + " / 수정" };

  db.collection("webtoonComment").updateOne(
    { _id: ObjectId(req.body._id) },
    { $set: comment },
    (error, result) => {
      console.log("댓글 수정 성공");
      console.log(comment, req.body._id);
      res.json({ update: true });
    }
  );
});

// 만화 댓글 좋아요
app.put("/webtoon/like", Login, (req, res) => {
  db.collection("webtoonComment")
    .findOne({ _id: ObjectId(req.body._id) })
    .then((result) => {
      let likedIds;
      if (
        result.likedIds.some(
          (like) =>
            ObjectId(like).toString() === ObjectId(req.user._id).toString()
        )
      ) {
        console.log("중복");
        // 좋아요 중복시 삭제
        likedIds = result.likedIds.filter(
          (like) =>
            ObjectId(like).toString() !== ObjectId(req.user._id).toString()
        );
      } else {
        // 좋아요 추가
        console.log("추가");
        likedIds = [...result.likedIds, req.user._id];
      }

      let comment = {
        likedIds: likedIds,
      };

      db.collection("webtoonComment").updateOne(
        { _id: ObjectId(req.body._id) },
        { $set: comment },
        (error, result) => {
          if (result) {
            res.json({ like: true });
          }
        }
      );
    });
});

// 로그인 정보
app.get("/user", (req, res) => {
  db.collection("login")
    .findOne({ _id: ObjectId(req.user._id), pw: req.query.pw })
    .then((result) => {
      if (result) {
        res.json(result);
      }
    });
});

// 상대 정보
app.get("/profile", (req, res) => {
  db.collection("login")
    .findOne({ _id: ObjectId(req.query._id) })
    .then((result) => {
      if (result) {
        console.log(result);
        res.json(result);
      }
    });
});

// 자기정보 변경
app.put("/user/update", upload.single("profile"), (req, res) => {
  db.collection("login")
    .findOne({ _id: ObjectId(req.user._id) })
    .then((result) => {
      let user = {
        id: req.body.id,
        pw: req.body.pw,
        name: req.body.name,
        email: req.body.email,
        image: req.file
          ? req.file.filename
          : parseInt(req.body.deleteImg) === 0
          ? result.image
          : "default.jpg",
      };
      console.log(user);
      db.collection("login").updateOne(
        { _id: ObjectId(req.user._id) },
        { $set: user },
        (error, result) => {
          console.log("로그인 수정 성공");
          res.json({ edit: true });
        }
      );
    });
});

// 댓글 개수 가져오기
app.get("/comment/length", (req, res) => {
  db.collection("comment")
    .find({ boardId: req.query.board_id })
    .toArray()
    .then((result) => {
      res.json(result.length);
    });
});

// 내 글 가져오기
app.get("/myBoard", (req, res) => {
  db.collection("board")
    .find({ userId: ObjectId(req.user._id) })
    .toArray()
    .then((result) => {
      res.json(result);
    });
});

// 상대 글 가져오기
app.get("/userBoard", (req, res) => {
  db.collection("board")
    .find({ userId: ObjectId(req.query._id) })
    .toArray()
    .then((result) => {
      res.json(result);
    });
});

// 채팅
app.post("/chatroom", (req, res) => {
  db.collection("login")
    .findOne({ _id: ObjectId(req.body.chatuserId) })
    .then((result) => {
      const save = {
        title: [result.name, req.user.name],
        member: [ObjectId(req.body.chatuserId), req.user._id].sort(),
        date: new Date(),
      };
      db.collection("chatroom")
        .findOne({
          member: [ObjectId(req.body.chatuserId), req.user._id].sort(),
        })
        .then((result) => {
          if (!result) {
            db.collection("chatroom")
              .insertOne(save)
              .then((result) => {
                console.log("채팅방 생성");
                res.json({ chatroom: true });
              });
          } else {
            console.log("이미 채팅창이 있어요");
          }
        });
    });
});
// 채팅방 가져오기
app.get("/chat", Login, (req, res) => {
  db.collection("chatroom")
    .find({ member: req.user._id }) // array안에서 찾아도 가능
    .toArray()
    .then((result) => {
      console.log("데이터 : " + result);
      res.json(result);
    });
});

// 채팅 메시지
app.post("/message", Login, function (req, res) {
  let save = {
    chatroom: req.body.chatroom,
    content: req.body.content,
    userid: req.user.id,
    userObjectId: req.user._id,
    date: new Date(),
  };
  db.collection("message")
    .insertOne(save)
    .then(() => {
      console.log("메시지 성공");
      res.json({ message: true });
    });
});

app.get("/messages", Login, function (req, res) {
  db.collection("message")
    .find({ chatroom: req.query.chatRoomId })
    .toArray()
    .then((result) => {
      res.json(result);
    });
});

// 채팅방 찾기
app.get("/chatroomFind", (req, res) => {
  db.collection("chatroom")
    .findOne({ _id: ObjectId(req.query._id) })
    .then((result) => {
      res.json(result);
    });
});

// 알림
app.post("/notification", (req, res) => {
  db.collection("notification")
    .insertOne({
      userId: req.body.userId,
      date: req.body.date,
    })
    .then((result) => {
      console.log("알림");
      res.json({ notification: req.body.userId });
    });
});

app.get("/notificationGet", (req, res) => {
  db.collection("notification")
    .findOne({ userId: req.query.userId })
    .then((result) => {
      res.json(result);
      console.log(result);
    });
});

// 웹 소켓

io.on("connection", (socket) => {
  console.log("클라이언트가 연결되었습니다.");

  socket.on("message", (message, id, ids) => {
    console.log("클라이언트로부터 메시지 받음:", message);
    const date = new Date();
    io.emit("message", message, date, id, ids); // 모든 클라이언트에게 메시지 전송
  });
});

// 내 댓글 가져오기
app.get("/myComment", (req, res) => {
  db.collection("comment")
    .find({ userId: ObjectId(req.query.userId) })
    .toArray()
    .then((result) => {
      console.log(result);
      res.json(result);
    });
});

//  내 댓글 단 글 가져오기
app.get("/myComment/board", (req, res) => {
  db.collection("board")
    .findOne({ _id: ObjectId(req.query._id) })
    .then((result) => res.json(result));
});

// 만화 좋아요
app.put("/board/like", Login, (req, res) => {
  db.collection("board")
    .findOne({ _id: ObjectId(req.body._id) })
    .then((result) => {
      let likedIds;
      if (
        result.likedIds.some(
          (like) =>
            ObjectId(like).toString() === ObjectId(req.user._id).toString()
        )
      ) {
        console.log("중복");
        // 좋아요 중복시 삭제
        likedIds = result.likedIds.filter(
          (like) =>
            ObjectId(like).toString() !== ObjectId(req.user._id).toString()
        );
      } else {
        // 좋아요 추가
        console.log("추가");
        likedIds = [...result.likedIds, req.user._id];
      }

      let comment = {
        likedIds: likedIds,
      };

      db.collection("board").updateOne(
        { _id: ObjectId(req.body._id) },
        { $set: comment },
        (error, result) => {
          if (result) {
            res.json({ like: true });
          }
        }
      );
    });
});

// 좋아요한 글 가져오기
app.get("/board/liked", (req, res) => {
  db.collection("board")
    .find({ likedIds: ObjectId(req.query._id) })
    .toArray()
    .then((result) => {
      res.json(result);
    });
});

// app.use(express.static(path.join(__dirname, "webtoon/build")));

// app.get("/", function (요청, 응답) {
//   응답.sendFile(path.join(__dirname, "/webtoon/build/index.html"));
// });

// app.get("*", function (요청, 응답) {
//   응답.sendFile(path.join(__dirname, "/webtoon/build/index.html"));
// });

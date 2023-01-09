/* eslint-disable no-undef */
const request = require("supertest");
var cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");
let server;
let agent;

function getCsrfToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

async function login(agent, username, password) {
  let res = await agent.get("/login");
  var csrfToken = getCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password: password,
    _csrf: csrfToken,
  });
}

describe("Test case for database", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(process.env.PORT || 4000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });

  test("Sign Up", async () => {
    var res = await agent.get("/signup");
    var csrfToken = getCsrfToken(res);
    const response = await agent.post("/users").send({
      firstName: "john",
      lastName: "wesley",
      email: "wesley@gmail.com",
      password: "john",
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
  });

  test("sign out", async () => {
    var res = await agent.get("/todos");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/todos");
    expect(res.statusCode).toBe(302);
  });

  test("Creates a todo", async () => {
    var agent = request.agent(server);
    await login(agent, "wesley@gmail.com", "john");
    var res = await agent.get("/todos");
    var csrfToken = getCsrfToken(res);
    const response = await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
  });

  test("Mark todo as a completed (updating todo)", async () => {
    var agent = request.agent(server);
    await login(agent, "wesley@gmail.com", "john");
    var res = await agent.get("/todos");
    var csrfToken = getCsrfToken(res);
    await agent.post("/todos").send({
      title: "Do HomeWork",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });

    const Todos = await agent.get("/todos").set("Accept", "application/json");
    const parseTodos = JSON.parse(Todos.text);
    const countTodaysTodos = parseTodos.dueToday.length;
    const Todo = parseTodos.dueToday[countTodaysTodos - 1];
    const status = Todo.completed ? false : true;
    res = await agent.get("/todos");
    csrfToken = getCsrfToken(res);

    const changeTodo = await agent
      .put(`/todos/${Todo.id}`)
      .send({ _csrf: csrfToken, completed: status });

    const parseUpadteTodo = JSON.parse(changeTodo.text);
    expect(parseUpadteTodo.completed).toBe(true);
  });

  test("Mark todo as  incompleted (updating todo)", async () => {
    var agent = request.agent(server);
    await login(agent, "wesley@gmail.com", "john");
    var res = await agent.get("/todos");
    var csrfToken = getCsrfToken(res);
    await agent.post("/todos").send({
      title: "go to ground",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });

    const Todos = await agent.get("/todos").set("Accept", "application/json");
    const parseTodos = JSON.parse(Todos.text);
    const countTodaysTodos = parseTodos.dueToday.length;
    const Todo = parseTodos.dueToday[countTodaysTodos - 1];
    const status = Todo.completed ? true : false;
    res = await agent.get("/todos");
    csrfToken = getCsrfToken(res);

    const changeTodo = await agent
      .put(`/todos/${Todo.id}`)
      .send({ _csrf: csrfToken, completed: status });

    const parseUpadteTodo = JSON.parse(changeTodo.text);
    expect(parseUpadteTodo.completed).toBe(false);
  });

  test("userA cannot update userB's todo", async () => {
    const agent = request.agent(server);

    let x1 = await agent.get("/signup");
    let csrfToken = getCsrfToken(x1);

    await agent.post("/users").send({
      firstName: "john",
      lastName: "wesley",
      email: "wesley@gmail.com",
      password: "john",
      _csrf: csrfToken,
    });

    let res = await agent.get("/todos");
    csrfToken = getCsrfToken(res);

    await agent.post("/todos").send({
      title: "play cricket",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });

    const groupedTodosResponse = await agent
      .get("/todos")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text);
    const dueTodayCount = parsedGroupedResponse.dueToday.length;
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1];

    await agent.get("/signout");

    let x3 = await agent.get("/signup");
    csrfToken = getCsrfToken(x3);

    await agent.post("/users").send({
      firstName: "john",
      lastName: "wesley",
      email: "wesley@gmail.com",
      password: "john",
      _csrf: csrfToken,
    });

    res = await agent.get("/todos");
    csrfToken = getCsrfToken(res);

    const markCompleteResponse = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({
        _csrf: csrfToken,
      });

    const parsedUpdateResponse = JSON.parse(markCompleteResponse.text);
    expect(parsedUpdateResponse.completed).toBe(false);
  });

  test("userA cannot delete userB's todo", async () => {
    const agent = request.agent(server);
    await login(agent, "wesley@gmail.com", "john");

    const groupedTodosResponse = await agent
      .get("/todos")
      .set("Accept", "application/json");

    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text);
    const dueTodayCount = parsedGroupedResponse.dueToday.length;
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1];

    await agent.get("/signout");

    await login(agent, "wesley@gmail.com", "john");

    res = await agent.get("/todos");
    csrfToken = getCsrfToken(res);

    const deleteResponse = await agent.delete(`/todos/${latestTodo.id}`).send({
      _csrf: csrfToken,
    });

    const deletestatus = JSON.parse(deleteResponse.text);
    expect(deletestatus).toBe(false);
  });


  test("Deletes a todo with the given ID if it exists and sends a boolean response", async () => {
    var agent = request.agent(server);
    await login(agent, "wesley@gmail.com", "john");
    var res = await agent.get("/todos");
    var csrfToken = getCsrfToken(res);
    await agent.post("/todos").send({
      title: "Buy xbox",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    

    const Todos = await agent.get("/todos").set("Accept", "application/json");
    const parseTodos = JSON.parse(Todos.text);
    const countTodaysTodos = parseTodos.dueToday.length;
    const Todo = parseTodos.dueToday[countTodaysTodos - 1];
    const todoID = Todo.id;

    res = await agent.get("/todos");
    csrfToken = getCsrfToken(res);

    const rese = await agent
      .delete(`/todos/${todoID}`)
      .send({ _csrf: csrfToken });

    const bool = Boolean(rese.text);
    expect(bool).toBe(true);
  });
});

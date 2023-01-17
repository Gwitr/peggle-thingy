// TODO: Consider giving Dispenser and Circle a common parent class, maybe? (They all implement update, draw and destroy,
//       and they all take the world as a parameter)

// TODO: Reduce global state, maybe make the world be more than just an array?

const DISPENSER_RADIUS = 160;
const INITIAL_BALL_SPEED = 200;
const GRAVITY = 220;
const PEG_RADIUS = 10;

var canvas = null;
var ctx = null;
var mouseX = 0, mouseY = 0;

class Dispenser {
    constructor(world, x, y, r, initialBallSpeed) {
        this.world = world;
        this.x = x;
        this.y = y;
        this.r = r;
        this.angle = 0;
        this.initialBallSpeed = initialBallSpeed;

        this._clickCallback = this.onClick.bind(this);
        canvas.addEventListener("click", this._clickCallback);
    }

    onClick(e) {
        if (e.button !== 0)
            return;
        e.preventDefault();

        let circle = new Ball(this.world, this.x + this.r * Math.cos(this.angle), this.y + this.r * Math.sin(this.angle), 9);
        circle.vx = this.initialBallSpeed * Math.cos(this.angle);
        circle.vy = this.initialBallSpeed * Math.sin(this.angle);
    }

    findShootAngle(mouseX, mouseY, gravity) {
        // TODO: Better search method than just looping through the angles
        let minError = Infinity;
        let minAngle = 0;
        for (let angle of Array(980).fill(0).map((_, i) => i * Math.PI / 980)) {
            let startX = this.x + Math.cos(angle) * this.r;
            let startY = this.y + Math.sin(angle) * this.r;

            let interceptT = (mouseX - startX) / (this.initialBallSpeed * Math.cos(angle));
            if (interceptT < 0)
                continue;

            let yError = Math.abs(startY + this.initialBallSpeed * Math.sin(angle) * interceptT + 0.5 * gravity * interceptT**2 - mouseY);
            if (yError < minError) {
                minError = yError;
                minAngle = angle;
            }
        }
        return minAngle;
    }

    update() {
        this.angle = this.findShootAngle(mouseX, mouseY, GRAVITY);
    }

    draw() {
        ctx.save();
            ctx.translate(400, 0);
            ctx.rotate(this.angle - Math.PI / 2);
            ctx.translate(0, this.r);
            ctx.beginPath();
                ctx.moveTo(-10, -25);
                ctx.lineTo(10, -25);
                ctx.lineTo(0, 0);
                ctx.lineTo(-10, -25);
            ctx.stroke();
        ctx.restore();
    }

    destroy() {
        canvas.removeEventListener("click", this._clickCallback);
    }
}

class Circle {
    constructor(world, x, y, r, isStatic) {
        this.x = x;
        this.y = y;
        this.r = r;

        this.vx = 0;
        this.vy = 0;

        this.isStatic = !!isStatic;

        world.push(this);
        this.world = world;
    }

    update(deltaTime) {
        if (this.isStatic)
            return;

        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;

        for (let obj of this.world) {
            if (Object.is(obj, this))
                continue;

            let [unstickVector, normal] = obj.collide(this);
            if (unstickVector === null)
                continue;

            // Static resolution
            this.x += unstickVector.x;
            this.y += unstickVector.y;

            // Dynamic resolution
            let dot = normal.x * this.vx + normal.y * this.vy;
            this.vx -= 2 * dot * normal.x;
            this.vy -= 2 * dot * normal.y;

            // damp along direction
            dot = normal.x * this.vx + normal.y * this.vy;
            this.vx -= 0.3 * dot * normal.x;
            this.vy -= 0.3 * dot * normal.y;
        }

        if (this.x < -this.r || this.x > 800 + this.r || this.y < -this.r || this.y > 600 + this.r)
            this.destroy();
    }

    collide(other) {
        if (other instanceof Circle) {
            let dist = Math.sqrt((other.x - this.x)**2 + (other.y - this.y)**2);
            if (dist > this.r + other.r)
                return [null, null];
            return [
                {
                    x: -(other.x - this.x) / dist * (dist - this.r - other.r),
                    y: -(other.y - this.y) / dist * (dist - this.r - other.r)
                },
                {
                    x: -(other.x - this.x) / dist,
                    y: -(other.y - this.y) / dist
                }
            ];

        } else {
            throw new Error("Circle: idk how to collide with a " + other);
        }
    }

    draw() {
        ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI);
        ctx.stroke();
    
        ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.arc(this.x, this.y, this.r, -Math.PI / 10, Math.PI / 10);
            ctx.lineTo(this.x, this.y);
            ctx.fillStyle = "black";
        ctx.fill();
    }

    destroy() {
        this.world.splice(this.world.findIndex(v => Object.is(this, v)), 1);
    }
};

class Ball extends Circle {
    constructor(world, x, y) {
        super(world, x, y, PEG_RADIUS * 0.65, false);
    }

    static simulatePath(world, x, y, vx, vy, timeStep, seconds) {
        // Note how we're instantiating a Circle here
        let ball = new Circle(world.filter(x => x.isStatic), x, y, PEG_RADIUS * 0.65, false);
        ball.vx = vx;
        ball.vy = vy;
        let points = [];
        for (let t = 0; t < seconds; t += timeStep) {
            points.push([ball.x, ball.y]);
            ball.vy += GRAVITY * timeStep;
            ball.update(timeStep);
        }
        ball.destroy();
        return points;
    }
};

class Peg extends Circle {
    static ORANGE = "orange";
    static BLUE = "blue";
    static PINK = "pink";
    static GREEN = "green";

    constructor(world, x, y, type) {
        super(world, x, y, PEG_RADIUS, true);
        this.type = type;
        this.timeToDie = null;
        console.log(type);
    }

    collide(other) {
        let res = super.collide(other);
        if (other instanceof Ball && this.timeToDie === null && res[0] != null)
            this.timeToDie = 1.5;
        return res;
    }

    update(deltaTime) {
        super.update(deltaTime);

        if (this.timeToDie !== null) {
            this.timeToDie -= deltaTime;
            if (this.timeToDie <= 0)
                this.destroy();
        }
    }

    draw() {
        ctx.fillStyle = {
            [Peg.ORANGE]: (this.timeToDie === null ? "#FFA500" : "#FFD530"),
            [Peg.BLUE]:   (this.timeToDie === null ? "#0000FF" : "#AAAAFF")
        }[this.type];

        ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI);
        ctx.fill();
    }
};

onload = () => {
    canvas = document.getElementById("game-canvas");
    ctx = canvas.getContext("2d");
    ctx.font = "16px serif";

    let world = [];
    let dispenser = new Dispenser(world, 400, 0, DISPENSER_RADIUS, INITIAL_BALL_SPEED);

    // Generate level
    for (let i = -5; i <= 5; i += 1) {
        for (let y = -2; y <= 2; y += 1) {
            new Peg(world,
                400 + 70 * i + (Math.random() * 2 - 1) * 20,
                420 + 70 * y + (Math.random() * 2 - 1) * 20,
                Math.random() > 0.75 ? Peg.ORANGE : Peg.BLUE
            );
        }
    }

    // Callback for updating mouse pos
    canvas.addEventListener("mousemove", e => {
        e.preventDefault();
        mouseX = e.offsetX;
        mouseY = e.offsetY;
    });

    // Mainloop
    let deltaTime;
    var mainloop = () => {
        requestAnimationFrame(mainloop);

        // Assume 60FPS. This may result in some slight animation slowdown, but it's worth it for the more consistent physics.
        deltaTime = 1/60;

        // Update the objects in the world
        for (let obj of world) {
            if (!obj.static)
                obj.vy += GRAVITY * deltaTime;
            obj.update(deltaTime);
        }
        dispenser.update();

        // Render the objects in the world
        ctx.fillStyle = "white";
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.fill();

        for (let obj of world)
            obj.draw();
        dispenser.draw();

        // Simulate a single ball falling to generate the visible path
        let points = Ball.simulatePath(
            world,
            400 + DISPENSER_RADIUS * Math.cos(dispenser.angle), 0 + DISPENSER_RADIUS * Math.sin(dispenser.angle),
            INITIAL_BALL_SPEED * Math.cos(dispenser.angle), INITIAL_BALL_SPEED * Math.sin(dispenser.angle),
            1/60, 50
        );

        // Draw that ball's path (TODO: This is kinda ineffecient)
        for (let i = 0; i < 20; ++i) {
            let pathDist = i * 25;

            let lastX = points[0][0], lastY = points[0][1];
            let totalDist = 0;
            for (let point of points.slice(1)) {
                let dist = Math.sqrt((point[0] - lastX) ** 2 + (point[1] - lastY) ** 2);
                if (dist + totalDist >= pathDist) {
                    lastX = lastX + (point[0] - lastX) / dist * (pathDist - totalDist);
                    lastY = lastY + (point[1] - lastY) / dist * (pathDist - totalDist);
                    break;
                } else {
                    totalDist += dist;
                    lastX = point[0];
                    lastY = point[1];
                }
            }

            ctx.beginPath();
                ctx.arc(lastX, lastY, 4, 0, 2 * Math.PI);
            ctx.stroke();
        }

        // Draw the cursor position as a + (it looks cool!) 
        ctx.beginPath();
            ctx.moveTo(mouseX - 10, mouseY);
            ctx.lineTo(mouseX + 10, mouseY);
            ctx.moveTo(mouseX, mouseY - 10);
            ctx.lineTo(mouseX, mouseY + 10);
        ctx.stroke();
    }
    requestAnimationFrame(mainloop);
};
